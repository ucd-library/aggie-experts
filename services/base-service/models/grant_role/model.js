// Can use this to get the fin configuration
//const {config} = require('@ucd-lib/fin-service-utils');
const {config, models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');

const finApi = require('@ucd-lib/fin-api/lib/api.js');

/**
 * @class GrantRoleModel
 * @description Base class for Aggie Experts data models.
 */
class GrantRoleModel extends BaseModel {

  static transformed_types = [ 'GrantRole' ];

  static types = [
    "http://schema.library.ucdavis.edu/schema#GrantRole"
  ];

  constructor(name='grant_role') {
    super(name);
  }

  /**
   * @method promote_node_to_doc
   * @description Promote the given node to a document. Return node components to be included in the document.
   * @param {Object} node :  node to promote
   * @returns {Object} : document object
   **/
  promote_node_to_doc(node) {
    const doc = {
      '@id': node['@id'],
      '@type': node['@type'],
      '@graph': [node]
    };
    return doc;
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
    let resp;

    logger.info({patch},`grant_role.patch for ${expertId}:`);
    if (patch.visible == null && patch.favourite == null) {
      return 400;
    }

    // Immediate Update Elasticsearch document
    const expertModel = await this.get_model('expert');
    let node;

    try {
      expert = await expertModel.client_get(expertId);
      node = this.get_node_by_related_id(expert,id);
      let node_id = node['@id'].replace("ark:/87287/d7mh2m/grant/","");
      if (!patch.objectId) {
        patch.objectId = node_id;
      }
    } catch(e) {
      console.error(e.message);
      logger.info(`relatedBy[{@id${id} not found in expert ${expertId}`);
      return 404
    };
    if (patch.visible != null) {
      node['relatedBy']['is-visible'] = patch.visible;
    }
    if (patch.favourite != null) {
      node['relatedBy']['is-favourite'] = patch.favourite;
    }
    await expertModel.update_graph_node(expertId,node);

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
    resp = await finApi.patch(options);

//    console.log({ options, id, patch, expertId, resp });

    if (config.experts.cdl_propagate_changes) {
      const cdl_user = await expertModel._impersonate_cdl_user(expert);
      if (patch.visible != null) {
        resp = await cdl_user.setLinkPrivacy({
          objectId: patch.objectId,
          privacy: patch.visible ? 'public' : 'internal'
        })
        logger.info({cdl_response:resp},`CDL propagate privacy ${config.experts.cdl_propagate_changes}`);
      }
      if (patch.favourite != null) {
        resp = await cdl_user.setFavourite(patch)
        logger.info({cdl_response:resp},`CDL propagate favourite ${config.experts.cdl_propagate_changes}`);
      }
    } else {
        logger.info({cdl_response:null},`XCDL propagate changes ${config.experts.cdl_propagate_changes}`);
      }
  }

  /**
   * @method update
   * @description Update Elasticsearch with the given data.
   */

  async update(transformed) {
    const root_node= this.get_expected_model_node(transformed);
    const doc = this.promote_node_to_doc(root_node);
    logger.info(`GrantRoleModel.update(${doc['@id']})`);
    await this.update_or_create_main_node_doc(doc);

    const have_part={};
    // Get the grant and the Expert via the GrantRole.relates
    const expertModel= await this.get_model('expert');
    const grantModel= await this.get_model('grant');
    // The root_node is the GrantRole node, pointers to Expert and Grant (which is now another node)
    for(let i=0; i<root_node?.relates?.length || 0; i++) {
      let relates = root_node.relates[i];
      try {
        let related = await expertModel.client_get(relates);
        let type = this.experts_node_type(related);
        // Is this a Expert?
        if (type !== 'Expert') {
          throw new Error(`GrantRoleModel.update(${doc['@id']}) - ${relates} is not a Expert`);
        }
        have_part['Expert'] = {id:relates,node:related };
      } catch (e) {
        // Is this included Grant?
        let related = grantModel.get_expected_model_node(transformed);
        let type = this.experts_node_type(related);
        if (relates !== related['@id']) {
          throw new Error(`GrantRoleModel.update ${relates} !== ${related['@id']}`);
        }
        if (type !== 'Grant') {
          throw new Error(`GrantRoleModel.update ${relates} is not a Grant`);
        }
        have_part['Grant'] = {id:relates,node:related };
      }
    }
    if (have_part.Expert && have_part.Grant) {
      // Add Grant as snippet to Expert, relationship is in Grant
      const node = grantModel.snippet(have_part.Grant.node)
      logger.info(`${have_part.Expert.id} ==> ${have_part.Grant.id}`);
      await expertModel.update_graph_node(have_part.Expert.id,node);
    } else {
      if (have_part.Expert) {
        logger.info(`${have_part.Expert.id} =>? ?Grant?`);
      } else {
        if (have_part.Grant) {
          logger.info(`?Expert? ?=> ${have_part.Grant.id}`);
        } else {
          logger.info(`?Expert? ?=? ?Grant?`);
        }
      }
    }
  }
}
module.exports = GrantRoleModel;
