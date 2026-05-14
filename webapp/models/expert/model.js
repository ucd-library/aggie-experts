// Can use this to get the fin configuration
const {
  logger,
  config,
  ElementsClient,
  patchExpertVisibility,
  deleteExpert,
  patchExpertAvailability,
  patchGrantVisibility,
  patchWorkVisibility,
  deleteAuthorship
} = require('@ucd-lib/experts-commons');

const BaseModel = require('../base/model.js');
const validate = require('../validate.js');
const Citation = require('../../spa/client/public/lib/utils/citation.js');

/**
 * @class ExpertModel
 * @description Base class for Aggie Experts data models.
 */
class ExpertModel extends BaseModel {

  static transformed_types = [ 'Expert' ];
  static types = [
    "http://schema.library.ucdavis.edu/schema#Expert",
  ];

  constructor(name='expert') {
    super(name);
  }

  grantRole() {
    return new GrantRole(this);
  }

  Authorship() {
    return new Authorship(this);
  }
  /**
   * @method get
   * @description get a object by id. Add `expert` to id if it is not there.
   *
   * @param {String} id @graph.identifier or @graph.@id
   *
   * @returns {Promise} resolves to elasticsearch result
   */
  async get(id, opts={}) {
    if( id[0] === '/' ) id = id.substring(1);
    if( !id.startsWith('expert/') ) {
      id = 'expert/' + id;
    }
    return super.get(id, opts);
  }

  /**
   * @method snippet
   * @description returns searchable snippet of a node
   * by elasticsearch.
   */
  snippet(node) {
    const snippet= ["@id","@type",
                    "identifier","orcidId","name","contactInfo",
                    "is-visible"];

    // Get only best contact info
    if (node.contactInfo) {
      if (!Array.isArray(node.contactInfo)) {
        node.contactInfo = [node.contactInfo];
      }
      let best=node.contactInfo.sort((a,b) => {
        (a['rank'] || 100) - (b['rank'] || 100)})[0];
      ['hasOrganizationalUnit','hasTitle','hasURL','rank'].forEach(x => delete best[x]);
      node.contactInfo = [best];
    }

    // Now select some of the fields.
    let s = {};
    snippet.forEach((key) => {
      if (node[key]) {
        s[key] = node[key];
      }
    });
    return s;
  }

  async seo(id) {
    let result = await this.get(id);
    result = this.subselect(result, {
      expert : { include : true },
      grants : { include : true, page : 1, size : 5 },
      works : { include : true, page : 1, size : 10 }
    });

    let workModel = await this.get_model('work');
    let grantModel = await this.get_model('grant');

    let seo = {
      '@graph': []
    };

    result['@graph'].forEach(async (node) => {
      if (node['@type']) {
        if (!Array.isArray(node['@type'])) {
          node['@type'] = [node['@type']];
        }
        if (node['@type'].includes('Person')) {
          let personSeo = this.to_seo(node) || {};
          personSeo['@type'] = personSeo['@type'] || 'Person';
          if (!personSeo['@id'] && (node['@id'] || node.identifier)) {
            personSeo['@id'] = node['@id'] || node.identifier;
          }
          if (!personSeo.url && (node.url || node.hasURL || node['@id'])) {
            personSeo.url = node.url || node.hasURL || node['@id'];
          }
          seo["@graph"].push(personSeo);
        }
        if (node['@type'].includes('Work')) {
          seo["@graph"].push(workModel.to_seo(node));
        }
        if (node['@type'].includes('Grant')) {
          seo["@graph"].push(grantModel.to_seo(node));
        }
      }
    });
    return JSON.stringify(seo);
  }

  to_seo(node) {
    if (!Array.isArray(node['@type'])) {
      node['@type'] = [node['@type']];
    }
    if(! node['@type'].includes("Person")) {
      log.error(node,"not a Person")
    }
    let seo={}

    seo.name = node?.label;
    seo.identifier = node?.identifier;

    let description = [];
    if( node.overview ) description.push(node.overview);
    if( node.researchInterests ) description.push(node.researchInterests);
    if( description.length ) seo.description = description.join(' ');

    let knowsAbout = [];
    if( node.hasResearchArea && !Array.isArray(node.hasResearchArea) ) node.hasResearchArea = [node.hasResearchArea];
    if( node.hasResearchArea ) {
      knowsAbout = node.hasResearchArea.map(r => {
        return {
          '@id' : r['@id'],
          'name' : r['prefLabel'],
          '@type' : r['@type']
        }
      });
    }
    if( knowsAbout.length ) seo.knowsAbout = knowsAbout;

    if (node.contactInfo) {
      if (!Array.isArray(node.contactInfo)) {
        node.contactInfo = [node.contactInfo];
      }
      let best = node.contactInfo.sort((a,b) => { (a['rank'] || 100) - (b['rank'] || 100) });
      best.forEach((c)=> {
        if(c?.isPreferred) {
          if (c.hasOrganizationalUnit) {
            if (! seo.affiliation ) { seo.affiliation=[] }
            c.hasOrganizationalUnit["@type"] = "Organization";
            seo.affiliation.push(c.hasOrganizationalUnit);
          }
          if (c.hasTitle) {
          if (! seo.jobTitle ) { seo.jobTitle=[] }
            seo.jobTitle.push(c.hasTitle);
          }
        }
      });
    }
    return seo
  }

  /**
   * @method subselect
   * @description return all or part of a document, with optional subsets of works/grants when requested
   * @param {Object} doc
   * @param {Object} options, ie {admin:true|false, subset:true|false, expert:true|false, grants:{page:1,size:25,sanitize:true|false}, works:{page:1,size:25,sanitize:true|false}}
   * @returns {Object} : document
   **/
  subselect(doc, options={}) {
    /*
    options example:
      {
        'is-visible' : true|false,
        expert : { include : true },
        grants : {
          page : 1,
          size : 25,
          exclude : [ 'totalAwardAmount' ],
          includeMisformatted : true,
          sort : [
            {
              field : 'name',
              sort : 'desc',
              type : 'string'|'number'|'date'|'year'(to apply .split('-')[0] to the value),

              // experimental, impl later
              // might just be `type: title` to skip various words, but what other types and how defined?
              skip : 'A|The|An'
            }
          ],
          filter : [
            {
              date : {
                min : 2000|'none',
                max : 2020|'none'
              }
            }
          ]
        },
        works : { include : false }
      }
    */
    let defaults = {
      'is-visible' : true,
      expert : {
        include : true,
        size : -1
      },
      grants : {
        include : false,
        size : -1
      },
      works : {
        include : false,
        size : -1,
        includeMisformatted : false,
        favouriteWorksFirst : true,
        favouritesPlusFirstPageWorks : false,
        sort : [
          {
              "field": "issued",
              "sort": "desc",
              "type": "year"
            },
            {
              "field": "title",
              "sort": "asc",
              "type": "string"
            } ]
      }
    }

    function deepMerge(target, source) {
      const result = { ...target };

      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }

      return result;
    }

    options = deepMerge(defaults, options);

    if (doc["is-visible"] === false && !options.admin) {
      throw {status: 404, message: "Not found"};
    }

    function getNestedProperty(obj, path) {
      return path.split('.').reduce((acc, part) => acc && acc[part] ? acc[part] : undefined, obj);
    }

    function sortGraph(a, b, sort=[]) {
      for( let sortBy of sort ) {
        let aValue = getNestedProperty(a, sortBy.field);
        let bValue = getNestedProperty(b, sortBy.field);

        // custom processing by data type
        if( sortBy.type === 'year' ) {
          aValue = aValue.split('-')[0];
          bValue = bValue.split('-')[0];
        } else if( sortBy.type === 'string' ) {
          let comparisonResult = aValue.localeCompare(bValue);
          if (comparisonResult !== 0) {
            return sortBy.sort === 'desc' ? -comparisonResult : comparisonResult;
          }
        } else if( sortBy.type === 'date' ) {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        } else if( sortBy.type === 'number' ) {
          aValue = parseFloat(aValue);
          bValue = parseFloat(bValue);
        }

        if( aValue < bValue ) {
          return sortBy.sort === 'desc' ? 1 : -1;
        }
        if( aValue > bValue ) {
          return sortBy.sort === 'desc' ? -1 : 1;
        }
      }

      return 0; // sorts match
    }

    // split graph by type
    let expert = doc["@graph"].filter(graph => graph['@id'] === doc['@id']);
    let works = doc["@graph"].filter(graph => graph["@type"] === "Work" || graph["@type"].includes("Work"));
    let grants = doc["@graph"].filter(graph => graph["@type"] === "Grant" || graph["@type"].includes("Grant"));

    // to store totals of works/grants before filtering out any
    let totalWorks = works.length;
    let totalGrants = grants.length;

    let favouriteWorks = [];

    let visibleWorks = works.filter(w => {
      if (!Array.isArray(w.relatedBy)) {
        w.relatedBy = [w.relatedBy];
      }
      return w.relatedBy.some(related => related['is-visible'] && related?.relates?.some(r => r === doc['@id']));
    });

    let visibleGrants = grants.filter(g => {
      if (!Array.isArray(g.relatedBy)) {
        g.relatedBy = [g.relatedBy];
      }
      return g.relatedBy.some(related => related['is-visible'] && related['inheres_in']);
    });

    // by default, filter out hidden works/grants if not requested to include them, or if not admin/expert
    if( options['is-visible'] !== false || !options.admin ) {
      works = visibleWorks;
      grants = visibleGrants;
    }

    let hiddenWorks = totalWorks - visibleWorks.length;
    let hiddenGrants = totalGrants - visibleGrants.length;

    let invalidWorks = [];
    let invalidGrants = [];

    // filter out expert graph if not requested
    if( !options.expert?.include ) expert = [];

    // filter out works graph if not requested
    if( !options.works || !options.works?.include ) works = [];

    // filter out grants graph if not requested
    if( !options.grants || !options.grants?.include ) grants = [];

    // remove excluded fields in works if requested
    if( options.works?.exclude && options.works.exclude.length ) {
      works = works.map(work => {
        options.works.exclude.forEach(field => {
          delete work[field];
        });
        return work;
      });
    }

    // remove excluded fields in grants if requested
    if( options.grants?.exclude && options.grants.exclude.length ) {
      grants = grants.map(grant => {
        options.grants.exclude.forEach(field => {
          delete grant[field];
        });
        return grant;
      });
    }

    // remove grant amount if not admin
    if( !options.admin ) {
      grants = grants.map(grant => {
        delete grant.totalAwardAmount;
        return grant;
      });
    }

    // sort works if requested
    if( options.works?.include && options.works?.sort && options.works.sort.length ) {
      try {
        // remove works with invalid issue date or title before sorting
        let invalidTitle = Citation.validateTitle(works);
        if( invalidTitle.citations?.length ) {
          works = works.filter(w1 => !invalidTitle.citations.some(w2 => w2["@id"] === w1["@id"]));
          hiddenWorks += invalidTitle.citations.length;
          invalidTitle.citations = invalidTitle.citations.map(c => {
            return {
              ...c,
              title: 'Title Unknown'
            };
          });
        }

        let invalidIssueDate = Citation.validateIssueDate(works);
        if( invalidIssueDate.citations?.length ) {
          works = works.filter(w1 => !invalidIssueDate.citations.some(w2 => w2["@id"] === w1["@id"]));
          hiddenWorks += invalidIssueDate.citations.length;
          invalidIssueDate.citations = invalidIssueDate.citations.map(c => {
            return {
              ...c,
              issued: 'Date Unknown'
            };
          });
        }

        // default sort
        works = works.sort((a,b) => sortGraph(a, b, options.works.sort));

        if( options.works?.favouriteWorksFirst ) {
          // Sort works with favourites first, then apply regular sorting
          works = works.sort((a, b) => {
            // Check if works are favourites
            const aIsFavourite = a.relatedBy && Array.isArray(a.relatedBy)
              ? a.relatedBy.some(rel => rel['ucdlib:favourite'] === true)
              : a.relatedBy && a.relatedBy['ucdlib:favourite'] === true;

            const bIsFavourite = b.relatedBy && Array.isArray(b.relatedBy)
              ? b.relatedBy.some(rel => rel['ucdlib:favourite'] === true)
              : b.relatedBy && b.relatedBy['ucdlib:favourite'] === true;

            // favourites come first
            if (aIsFavourite && !bIsFavourite) return -1;
            if (!aIsFavourite && bIsFavourite) return 1;

            // If both are favourites or both are not favourites, apply regular sorting
            return sortGraph(a, b, options.works.sort);
          });
        }

        // to handle favourites in the ui on the edit works page vs expert profile page
        // the first edit works page will show all favourites plus 25 works (including favourites if in that list)
        // pages 2+ will show just 25 works in order (including favourites if in that list)
        favouriteWorks = works.filter(w => {
          return w.relatedBy && (Array.isArray(w.relatedBy)
            ? w.relatedBy.some(rel => rel['ucdlib:favourite'] === true)
            : w.relatedBy && w.relatedBy['ucdlib:favourite'] === true);
        });


        if( options.works?.includeMisformatted ) {
          invalidWorks = [...(invalidTitle.citations || []), ...(invalidIssueDate.citations || [])];
          doc.invalidWorks = invalidWorks;
        }

        totalWorks = works.length;
      } catch(e) {
        // no sorting if unexpected exception
      }
    }

    // sort grants if requested
    if( options.grants?.include && options.grants?.sort && options.grants.sort.length ) {
      try {
        let invalidName = grants.filter(g => typeof g.name !== 'string');
        if( invalidName.length ) {
          grants = grants.filter(g1 => !invalidName.some(g2 => g2["@id"] === g1["@id"]));
          hiddenGrants += invalidName.length;
          invalidName = invalidName.map(g => {
            return {
              ...g,
              name: 'Name Unknown'
            };
          });
        }

        let invalidEndDate = grants.filter(g => isNaN(new Date(g.dateTimeInterval?.end?.dateTime)));
        if( invalidEndDate.length ) {
          grants = grants.filter(g1 => !invalidEndDate.some(g2 => g2["@id"] === g1["@id"]));
          hiddenGrants += invalidEndDate.length;
          invalidEndDate = invalidEndDate.map(g => {
            return {
              ...g,
             dateTimeInterval: { end : { dateTime : 'Date Unknown' } }
            };
          });
        }

        grants = grants.sort((a,b) => sortGraph(a, b, options.grants.sort));

        if( options.grants?.includeMisformatted ) {
          invalidGrants = [...invalidName, ...invalidEndDate];
          doc.invalidGrants = invalidGrants;
        }

        totalGrants = grants.length;
      } catch(e) {
        // no sorting if unexpected exception
      }
    }

    // subset works if requested
    if( options.works?.page && options.works?.size ) {
      works = works.slice((options.works.page-1) * options.works.size, options.works.page * options.works.size);
    }

    // subset grants if requested
    if( options.grants?.page && options.grants?.size ) {
      grants = grants.slice((options.grants.page-1) * options.grants.size, options.grants.page * options.grants.size);
    }

    if( options.works?.favouritesPlusFirstPageWorks ) {
      works = [...favouriteWorks, ...works];
    }

    // return total visible/hidden works/grants
    doc.totals = {
      works: totalWorks,
      grants: totalGrants,
    };

    if( options.admin ) {
      doc.totals.hiddenWorks = hiddenWorks;
      doc.totals.hiddenGrants = hiddenGrants;
    }

    doc['@graph'] = [...expert, ...works, ...grants]
    return doc;
  }

  /**
   * @method promote_node_to_doc
   * @description Promotes some node fields to document fields
   * @param {Object} node
   * @returns {Object} : document
   **/
  promote_node_to_doc(node) {
    const doc = {
      "@id": node['@id'],
      "@context": config?.server?.url+"/api/schema/context.jsonld",
      "@graph": [node]
    };
    return this.move_fields_to_doc(node, doc);
  }

  move_fields_to_doc(node, doc) {
    doc["@type"] = "Expert";
    // Add visibility
    if (node["is-visible"]) {
      doc["is-visible"] = node["is-visible"];
    }
    if (node["hasAvailability"]) {
      doc["hasAvailability"]=[];
      if (! Array.isArray(node["hasAvailability"])) {
        node["hasAvailability"] = [node["hasAvailability"]];
      }
      // this is for later if we want to pair down the availability
      node["hasAvailability"].forEach(availability => {
        doc["hasAvailability"].push(availability);
      });
    }

    // Order the vcards, and get the first one
    let contact
    let hasEmail=[];
    let hasURL=[];
    if (node["contactInfo"]) {
      if (! Array.isArray(node["contactInfo"])) {
        node["contactInfo"] = [ node["contactInfo"] ];
      } else {
        node["contactInfo"].sort((a,b)=>a["rank"]-b["rank"])
      }
      contact = node["contactInfo"]?.[0];
      // get the hasURL
      node["contactInfo"].forEach((info)=>{
        if (info.hasEmail) {
          hasEmail=hasEmail.concat(info.hasEmail);
        }

        if (info?.hasURL) {
          hasURL=hasURL.concat(info.hasURL);
        }
      });
    }

    doc["contactInfo"] = {};

    if (hasURL.length > 0) {
      doc.contactInfo["hasURL"] = hasURL;
    }

    doc.contactInfo["hasEmail"] = hasEmail?.[0];

    ["name","hasName","hasTitle","hasOrganizationalUnit"].forEach((key)=>{
      if (contact[key]) {
        doc.contactInfo[key] = contact[key];
      }
    });
    if (doc.contactInfo.name) {
      doc.name = doc.contactInfo.name;
    }

    return doc;
  }

  /**
   * @method _impersonate_cdl_user
   * @description Get authorship by id
   * @param {Object} expert : expert elasticsearch record
   * @param {Object} args : {instance: "qa|prod"} which CDL instance to use
   * @returns {Object} : an Impersonator object
   * @throws {Error} : if expert not found, or if impersonation fails
   **/
  async _impersonate_cdl_user(expert,args) {
    let root_node = this.get_expected_model_node(expert);
    if (! Array.isArray(root_node.identifier)) {
      root_node.identifier = [root_node.identifier];
    }
    let cdl_user_id;
    for (let i=0; i<root_node.identifier.length; i++) {
      if (root_node.identifier[i].startsWith('ark:/87287/d7mh2m/user/')) {
        cdl_user_id = root_node.identifier[i].replace('ark:/87287/d7mh2m/user/','');
        break;
      }
    }
    if (cdl_user_id == null) {
      throw new Error(`Unable to find CDL user id for ${expertId}`);
    }
    if (! this.elementsClient ) {
      this.ElementsClient = ElementsClient;
    }
    let cdl_user = await this.ElementsClient.impersonate(cdl_user_id,args);
    return cdl_user;
  }


  /**
   * @method update
   * @description Update Elasticsearch with the given data.
   */
  async update(transformed) {
    const root_node= this.get_expected_model_node(transformed);
    // If a doc exists, update this node only, otherwise create a new doc.
    logger.info(`ExpertModel.update(${root_node['@id']})`);
    try {
      let expert = await this.client_get(root_node['@id']);
      await this.update_graph_node(expert['@id'],root_node);
      expert = await this.client_get(root_node['@id']);
      this.move_fields_to_doc(root_node,expert);
      // reindex this expert again
      await this.client.index({
        index : this.writeIndexAlias,
        id : expert['@id'],
        document: expert
      });
    } catch (e) {
      // If the doc does not exist, create a new one.
      const doc = this.promote_node_to_doc(root_node);
      await this.update_or_create_main_node_doc(doc);
    }
  }

  async validate(jsonld) {
    return validate.validateExpert(jsonld);
  }

  /**
   * @method patch
   * @description Patch an expert as visible or not.
   * @param {Object} patch :  { "@id", "is-visible" }
   * @param {String} expertId : Expert Id
   * @returns {Object} : document object
   **/
  async patch(patch, expertId) {
    return patchExpertVisibility({
      expertModel: this,
      patch,
      expertId,
      logger,
      config
    });
  }

  /**
   * @method delete
   * @description Delete an expert
   * @param {String} expertId : Expert Id
  **/
  async delete(expertId) {
    return deleteExpert({
      expertModel: this,
      expertId,
      logger,
      config
    });
  }

  /**
   * @method patchAvailability
   * @description Patch an experts availability labels
   * @param {Object} data :  { "labelsToAddOrEdit", "labelsToRemove", "currentLabels" }
   * @param {String} expertId : Expert Id
   *
   * @returns {Object} : document object
   **/
  async patchAvailability(data, expertId) {
    return patchExpertAvailability({
      expertModel: this,
      data,
      expertId,
      logger,
      config
    });
  }
}

class GrantRole {
  constructor(expertModel) {
    this.expertModel = expertModel;
  }

  /**
   * @method patch
   * @description Patch an grant_role file.
   * @param {Object} patch :  { "@id", "is-visible", "favourite" }
   * @param {String} expertId : Expert Id
   * @returns {Object} : document object
   **/
  async patch(patch, expertId) {
    return patchGrantVisibility({
      expertModel: this.expertModel,
      patch,
      expertId,
      logger,
      config
    });
  }
}

class Authorship {

  constructor(expertModel) {
    this.expertModel = expertModel;
  }

  /**
   * @method patch
   * @description Patch an authorship file.
   * @param {Object} patch :  { "@id", "is-visible", "favourite" }
   * @param {String} expertId : Expert Id
   * @returns {Object} : document object
    **/
  async patch(patch, expertId) {
    return patchWorkVisibility({
      expertModel: this.expertModel,
      patch,
      expertId,
      logger,
      config
    });
  }

  /**
   * @method delete
   * @description Delete an authorship file
   * @param {String} id of work
   * @param {String} expertId : Expert Id
  **/
  async delete(id, expertId) {
    return deleteAuthorship({
      expertModel: this.expertModel,
      id,
      expertId,
      logger,
      config
    });
  }
}


module.exports = ExpertModel;
