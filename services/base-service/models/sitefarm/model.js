// Can use this to get the fin configuration
const { config, models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');

/**
 * @class SiteFarmModel
 * @description Base class for Aggie Experts data models.
 */
class SiteFarmModel extends BaseModel {

  static transformed_types = ['SiteFarm'];
  static types = [
    "http://schema.library.ucdavis.edu/schema#SiteFarm",
  ];

  constructor(name = 'sitefarm') {
    super(name);
  }

  /**
   * @method snippet
   * @description returns searchable snippet of a node
   * by elasticsearch.
   */
  snippet(node) {
    const snippet = ["identifier", "orcidId", "name", "contactInfo"];

    // Get only best contact info
    if (node.contactInfo) {
      let best = node.contactInfo.sort((a, b) => {
        (a['rank'] || 100) - (b['rank'] || 100)
      })[0];
      ['hasOrganizationalUnit', 'hasTitle', 'hasURL', 'rank'].forEach(x => delete best[x]);
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

    doc["@type"] = "Expert";
    // Add visibility
    if (node["is-visible"]) {
      doc["is-visible"] = node["is-visible"];
    }


    // Order the vcards, and get the first one
    let contact
    let hasEmail = [];
    let hasURL = [];
    if (node["contactInfo"]) {
      if (!Array.isArray(node["contactInfo"])) {
        node["contactInfo"] = [node["contactInfo"]];
      } else {
        node["contactInfo"].sort((a, b) => a["rank"] - b["rank"])
      }
      contact = node["contactInfo"]?.[0];
      // get the hasURL
      node["contactInfo"].forEach((info) => {
        if (info.hasEmail) {
          hasEmail = hasEmail.concat(info.hasEmail);
        }

        if (info?.hasURL) {
          hasURL = hasURL.concat(info.hasURL);
        }
      });
    }

    doc["contactInfo"] = {};

    if (hasURL.length > 0) {
      doc.contactInfo["hasURL"] = hasURL;
    }

    doc.contactInfo["hasEmail"] = hasEmail?.[0];

    ["name", "hasName", "hasTitle", "hasOrganizationalUnit"].forEach((key) => {
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
  async _impersonate_cdl_user(expert, args) {
    let root_node = this.get_expected_model_node(expert);
    if (!Array.isArray(root_node.identifier)) {
      root_node.identifier = [root_node.identifier];
    }
    let cdl_user_id;
    for (let i = 0; i < root_node.identifier.length; i++) {
      if (root_node.identifier[i].startsWith('ark:/87287/d7mh2m/user/')) {
        cdl_user_id = root_node.identifier[i].replace('ark:/87287/d7mh2m/user/', '');
        break;
      }
    }
    if (cdl_user_id == null) {
      throw new Error(`Unable to find CDL user id for ${expertId}`);
    }
    if (!this.elementsClient) {
      const { ElementsClient } = await import('@ucd-lib/experts-api');
      // console.log('elementsClient',ElementsClient);
      this.ElementsClient = ElementsClient;
    }
    let cdl_user = await this.ElementsClient.impersonate(cdl_user_id, args);
    return cdl_user;
  }


  /**
   * @method update
   * @description Update Elasticsearch with the given data.
   */

  async update(transformed) {
    const root_node = this.get_expected_model_node(transformed);
    const doc = this.promote_node_to_doc(root_node);
    // console.log(`${this.constructor.name}.update(${doc['@id']})`);
    await this.update_or_create_main_node_doc(doc);

    const authorshipModel = await this.get_model('authorship');
    //const workModel=await this.get_model('work');

    // Update all Works with this Expert as well
    let authorships = await authorshipModel.esMatchNode({ 'relates': doc['@id'] });

    for (let i = 0; i < authorships?.hits?.hits?.length || 0; i++) {
      authorshipModel.update(authorships.hits.hits[i]._source);
      workModel.update(authorships.hits.hits[i]._source);
    }
  }
}
module.exports = SiteFarmModel;
