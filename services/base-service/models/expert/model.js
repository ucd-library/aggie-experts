// Can use this to get the fin configuration
const {models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');
const validate = require('../validate.js');

const finApi = require('@ucd-lib/fin-api/lib/api.js');
const config = require('../config');
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
    result = this.subselect(result, {expert:{include:true}, grants:{include:true}, works:{include:true}});
    return JSON.stringify({ '@context': result['@context'], '@graph': result['@graph'] });
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

        works = works.sort((a,b) => sortGraph(a, b, options.works.sort));
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

    /*
      TODO tbd in the future, for search we'll want to filter by dates and potentially other values,
          will implement once search is built out more
      // filter works by field(s) if requested
      // filter grants by field(s) if requested
    */

    // return total visible/hidden works/grants
    // TODO ask QH, does this need to be hidden if not admin/expert?
    doc.totals = {
      works: totalWorks,
      grants: totalGrants,
      hiddenWorks,
      hiddenGrants
    };

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
      const { ElementsClient } = await import('@ucd-lib/experts-api');
      // console.log('elementsClient',ElementsClient);
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
      // We are not yet maintaining authorship and work models.
      // const authorshipModel=await this.get_model('authorship');
      // Update all Works with this Expert as well
      // let authorships= await authorshipModel.esMatchNode({ 'relates': doc['@id'] });
      //
      //for (let i=0; i<authorships?.hits?.hits?.length || 0; i++) {
      //  authorshipModel.update(authorships.hits.hits[i]._source);
      //  workModel.update(authorships.hits.hits[i]._source);
      //}
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
    let expert;
     let resp;

    logger.info(patch,`expert.patch(${expertId})`);
    if (patch.visible == null ) {
      throw new Error('Invalid patch, visible is required');
    }

    // Immediate Update Elasticsearch document
    const expertModel = await this.get_model('expert');

    try {
      expert = await expertModel.client_get(expertId);
    } catch(e) {
      e.message = `expert "@id"=${expertId} not found`;
      e.status=500;
      throw e;
    };
    if (patch.visible != null) {
      expert['is-visible'] = patch.visible;
    }
    // Just update the existing document
    await this.client.index({
      index : this.writeIndexAlias,
      id : expert['@id'],
      document: expert
    });

    // Update FCREPO
    let options = {
      path: expertId,
      content: `
        PREFIX ucdlib: <http://schema.library.ucdavis.edu/schema#>
        PREFIX expert: <http://experts.ucdavis.edu/${expertId}>
        DELETE {
          ${patch.visible != null ? `expert: ucdlib:is-visible ?v .`:''}
        }
        INSERT {
          ${patch.visible != null ?`expert: ucdlib:is-visible ${patch.visible} .`:''}
        } WHERE {
          expert: ucdlib:is-visible ?v .
        }
      `
    };

    const api_resp = await finApi.patch(options);

    if (api_resp.last.statusCode != 204) {
      logger.error((({statusCode,body})=>({statusCode,body}))(api_resp.last),`expert.patch(${expertId})`);
      const error=new Error(`Failed fcrepo patch to ${expertId}:${api_resp.last.body}`);
      error.status=500;
      throw error;
    }
  }

  /**
   * @method delete
   * @description Delete an expert
   * @param {String} expertId : Expert Id
  **/
  async delete(expertId) {
    logger.info(`expert.delete(${expertId})`);

    // Delete Elasticsearch document
    let expert;

    try {
      expert = await this.client_get(expertId);
    } catch(e) {
      logger.info(`expert @id ${expertId} not found`);
      return 404
    };

    await this.client.delete(
      {id:expertId,
       index:this.writeIndexAlias
      });

    await finApi.delete(
      {
        path: expertId,
        permanent: true
      }
    );

    if (config.experts.cdl.expert.propagate) {
      const cdl_user = await this._impersonate_cdl_user(expert,config.experts.cdl.expert);
      let resp = await cdl_user.updateUserPrivacyLevel({
        privacy: 'internal'
      })
      logger.info({cdl_response:resp},`CDL propagate privacy ${config.experts.cdl.expert.propagate}`);
    } else {
      logger.info({cdl_response:null},`CDL propagate changes ${config.experts.cdl.expert.propagate}`);
    }
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
    let expert;

    try {
      expert = await this.client_get(expertId);
    } catch(e) {
      logger.info(`expert @id ${expertId} not found`);
      return 404
    };

    var patch=`PREFIX ucdlib: <http://schema.library.ucdavis.edu/schema#>
        PREFIX hasAvail: <ark:/87287/d7mh2m/keyword/c-ucd-avail/>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
delete {
    ?expert ucdlib:hasAvailability ?cur.
    ?cur skos:prefLabel ?curLabel.
    ?cur skos:inScheme ?curScheme.
    ?cur a skos:Concept.
    ?cur ucdlib:availabilityOf ?expert.
}
where {
  ?expert ucdlib:hasAvailability ?cur.
  OPTIONAL {
    ?cur skos:prefLabel ?curLabel.
  }
  OPTIONAL {
    ?cur skos:inScheme ?curScheme.
  }
};`;

    if (data.currentLabels.length > 0) {
      patch+=`
insert {
  ?expert ucdlib:hasAvailability ?add.
  ?add a skos:Concept;
    skos:inScheme hasAvail: ;
    skos:prefLabel ?addLabel;
    .
    ?add ucdlib:availabilityOf ?expert.
}
where {
  ?expert a ucdlib:Expert.
  values ?addLabel {  ${data.currentLabels.map(label => `"${label}"`).join(' ')} }
  bind(uri(concat(str(hasAvail:),encode_for_uri(?addLabel))) as ?add)
};`;
    }
    // update fcrepo
    let options = {
      path: expertId,
      content: patch
    };

    const api_resp = await finApi.patch(options);

    // update cdl
    if (config.experts.cdl.expert.propagate) {
      const cdl_user = await this._impersonate_cdl_user(expert, config.experts.cdl.expert);
      let resp = await cdl_user.updateUserAvailabilityLabels({
        labelsToAddOrEdit: data.labelsToAddOrEdit,
        labelsToRemove: data.labelsToRemove
      });
      logger.info({cdl_response:resp},`CDL propagate privacy ${config.experts.cdl.expert.propagate}`);
    } else {
      logger.info({cdl_response:null},`CDL propagate changes ${config.experts.cdl.expert.propagate}`);
    }
  }

}

class GrantRole {
  constructor(expertModel) {
    this.expertModel = expertModel;
  }

  /**
   * @method patch
   * @description Patch an grant_role file.
   * @param {Object} patch :  { "@id", "is-visible","is-favourite" "objectId" }
   * @param {String} expertId : Expert Id
   * @returns {Object} : document object
   **/
  async patch(patch, expertId) {
    let id = patch['@id'];
    let expert;
    let node;
    let resp;

    logger.info({expert:expertId,patch},`expert.grantRole.patch(${expertId})`);
    if (patch.visible == null && patch.favourite == null) {
      return 400;
    }

    // Immediate Update Elasticsearch document
    try {
      expert = await this.expertModel.client_get(expertId);
      node = this.expertModel.get_node_by_related_id(expert,id);

      if (!patch.objectId) {
        // loop through node.identifiers and find the one that matches 'ark:/87287/d7mh2m/grant/'
        if (typeof node?.identifier === 'string') {
          node.identifier = [node.identifier];
        }
        for (let i=0; i<node?.identifier?.length; i++) {
          if (node.identifier[i].startsWith('ark:/87287/d7mh2m/')) {
            patch.objectId = node.identifier[i].replace('ark:/87287/d7mh2m/','');
            break;
          }
        }
        if (!patch.objectId) {
          throw {
            status: 500,
            message: `CDL identifier not found in expert ${expertId}`
          }
        }
      }
    } catch(e) {
      e.message = `relatedBy[${id}] not found in expert ${expertId}: ${e.message}`;
      e.status=500;
      throw e;
    };
    if (patch.visible != null) {
      node['relatedBy']['is-visible'] = patch.visible;
    }
    if (patch.favourite != null) {
      node['relatedBy']['is-favourite'] = patch.favourite;
    }
    await this.expertModel.update_graph_node(expertId,node);

    // Update FCREPO

    let options = {
      path: expertId + '/' + id,
      content: `
        PREFIX ucdlib: <http://schema.library.ucdavis.edu/schema#>
        DELETE {
          ${patch.visible != null ? `<${id}> ucdlib:is-visible ?v .`:''}
          ${patch.favourite !=null ?`<${id}> ucdlib:is-favourite ?fav .`:''}
        }
        INSERT {
          ${patch.visible != null ?`<${id}> ucdlib:is-visible ${patch.visible} .`:''}
          ${patch.favourite != null ?`<${id}> ucdlib:is-favourite ${patch.favourite} .`:''}
        } WHERE {
          <${id}> ucdlib:is-visible ?v .
          OPTIONAL { <${id}> ucdlib:is-favourite ?fav } .
        }
      `
    };
    const api_resp = await finApi.patch(options);

    if (api_resp.last.statusCode != 204) {
      logger.error((({statusCode,body})=>({statusCode,body}))(api_resp.last),`grant_role.patch for ${expertId}`);
      const error=new Error(`Failed fcrepo patch to ${id}:${api_resp.last.body}`);
      error.status=500;
      throw error;
    }
    if (config.experts.cdl.grant_role.propagate) {
      const cdl_user = await this.expertModel._impersonate_cdl_user(expert,config.experts.cdl.grant_role);
      if (patch.visible != null) {
        resp = await cdl_user.setLinkPrivacy({
          objectId: patch.objectId,
          categoryId: 2,
          privacy: patch.visible ? 'public' : 'internal'
        })
        logger.info({cdl_response:resp},`CDL propagate privacy ${config.experts.cdl.grant_role.propagate}`);
      }
      if (patch.favourite != null) {
        resp = await cdl_user.setFavourite(patch)
        logger.info({cdl_response:resp},`CDL propagate favourite ${config.experts.cdl.grant_role.propagate}`);
      }
    } else {
      logger.info({cdl_response:null},`CDL propagate changes ${config.experts.cdl.grant_role.propagate}`);
    }
  }


}

module.exports = ExpertModel;
