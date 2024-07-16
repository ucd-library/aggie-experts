// Can use this to get the fin configuration
const {models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');
const validate = require('../validate.js');

const finApi = require('@ucd-lib/fin-api/lib/api.js');
const config = require('../config');

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

  /**
   * @method snippet
   * @description returns searchable snippet of a node
   * by elasticsearch.
   */
  snippet(node) {
    const snippet= ["identifier","orcidId","name","contactInfo"];

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

    if (doc["is-visible"] === false) {
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
    let hiddenWorks = totalWorks - works.filter(w => w.relatedBy?.['is-visible']).length;
    let hiddenGrants = totalGrants - grants.filter(g =>
      g.relatedBy && g.relatedBy.some(related => related['is-visible'] && related['inheres_in'])
    ).length;

    // by default, filter out hidden works/grants if not requested to include them
    // TODO ask QH, should we also filter out hidden works/grants if they're not an admin/the expert?
    if( options['is-visible'] !== false ) {
      works = works.filter(w => w.relatedBy?.['is-visible']);

      grants = grants.filter(g =>
        g.relatedBy && g.relatedBy.some(related => related['is-visible'] && related['inheres_in'])
      );
    }

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
    if( options.works?.sort && options.works.sort.length ) {
      try {
        // TODO analyze variation in 'issued' and 'title', add try/catch to prevent exceptions for unexpected data
        // THIS WILL DEFINITELY FAIL ATM for works that have an array for title or issued, which happens
        // in that case we still want to show in the ui, but that it's malformed, so they can fix it
        // FROM VE (in https://github.com/ucd-library/aggie-experts/issues/540):
        // Can you apply the "misformated citation, contact admin" label here?
        // There isn't a good default solution to the handful of examples I've seen when the titles clash.




        // TODO 7/11
        // test with /expert/0a4HWjVZ (ark:/87287/d7mh2m/publication/1422547) and /expert/0atLvttS (ark:/87287/d7mh2m/publication/780095)
        // will need to compare against other works of theirs to see if it's working as expected
        works = works.sort((a,b) => sortGraph(a, b, options.works.sort));


      } catch(e) {
        // TODO what to do if title or issued is not string/array? or other sort data is unexpected?
      }
    }

    // sort grants if requested
    if( options.grants?.sort && options.grants.sort.length ) {
      try {
        grants = grants.sort((a,b) => sortGraph(a, b, options.grants.sort));
      } catch(e) {
        // TODO what to do if dateTime or name is not string/array? or other sort data is unexpected?
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

    // filter out expert graph if not requested
    // TODO ask QH, this assumes all options are explicit, and that if they are not passed in, they are not included
    if( !options.expert?.include ) expert = [];

    // filter out works graph if not requested
    if( !options.works || !options.works?.include ) works = [];

    // filter out grants graph if not requested
    if( !options.grants || !options.grants?.include ) grants = [];

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

}
module.exports = ExpertModel;
