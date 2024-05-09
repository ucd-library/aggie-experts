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
   * @method sanitize
   * @description Sanitize document
   * @param {Object} doc
   * @returns {Object} : sanitized document
   **/
  sanitize(doc) {
    if (doc["is-visible"] === false) {
      throw {status: 404, message: "Not found"};
    }

    function spliceOut(i) {
      if (doc["@graph"][i]?.["@type"] === "Expert") {
        throw {status: 404, message: "Not found"};
      } else {
        logger.info({function:"sanitize"},`_x_${doc["@graph"][i]["@id"]}`);
        doc["@graph"].splice(i, 1);
      }
    }

    for(let i=0; i<doc["@graph"].length; i++) {
      logger.info({function:"sanitize"},`${doc["@graph"][i]["@id"]}`);
      // Node is not visible
      if (("is-visible" in doc["@graph"][i]) &&
          doc["@graph"][i]?.["is-visible"] !== true) {
        spliceOut(i--);
      }

      if (doc["@graph"][i].relatedBy) {
        // relatedby is doc["@graph"][i]["relatedBy"] but always an array
        const relatedBy = Array.isArray(doc["@graph"][i].relatedBy) ?
              doc["@graph"][i].relatedBy : [doc["@graph"][i].relatedBy];
        for (let j=0; j<relatedBy.length; j++) {
          if ("is-visible" in relatedBy[j] && relatedBy[j]?.["is-visible"] !== true) {
            spliceOut(i--);
            break;
          }
        }
      }
      // Sanitize this node if it is an Grant (esp.)
      delete doc["@graph"][i]["totalAwardAmount"];
    }
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
   * @method remove
   * @description Delete an expert based on existing json-ld document.
   * @param {Object} jsonld : Expert Document
  **/
  async remove(jsonld) {
    return this.remove_from_elasticsearch(jsonld['@id']);
  }

  /**
   * @method remove_from_elasticsearch
   * @description Delete an expert from elasticsearch based on expertId.
   * @param {String} expertId : Expert Id
  **/
  async remove_from_elasticsearch(expertId) {
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

    await remove_from_elasticsearch(expertId);

    await finApi.delete(
      {
        path: expertId,
        permanent: true
      }
    );

    if (config.experts.cdl.expert.propagate) {
      const cdl_user = await expertModel._impersonate_cdl_user(expert,config.experts.cdl.expert);
      if (patch.visible != null) {
        let resp = await cdl_user.updateUserPrivacyLevel({
          userId: expertId,
          privacy: patch.visible ? 'public' : 'internal'
        })
        logger.info({cdl_response:resp},`CDL propagate privacy ${config.experts.cdl.expert.propagate}`);
      }
    } else {
      logger.info({cdl_response:null},`CDL propagate changes ${config.experts.cdl.expert.propagate}`);
    }
  }

}
module.exports = ExpertModel;
