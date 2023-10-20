// Can use this to get the fin configuration
//const {config} = require('@ucd-lib/fin-service-utils');
const {config, models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');

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
        // Is this a Expert?
        let related = await expertModel.client_get(relates);
        let type = this.experts_node_type(related);
        if (type !== 'Expert') {
          throw new Error(`GrantRoleModel.update(${doc['@id']}) - ${relates} is not a Expert`);
        }
        have_part['Expert'] = {id:relates,node:related };
      } catch (e) {
        // Is this included Grant?
        let related = grantModel.get_expected_model_node(transformed);
        let type = this.experts_node_type(related);
        if (relates !== related['@id']) {
          throw new Error(`GrantRoleModel.update ${relates} not included in doc`);
          if (type !== 'Grant') {
            throw new Error(`GrantRoleModel.update ${relates} is not a Grant`);
          }
          have_part['Grant'] = {id:relates,node:related };
        }
      }
      if (have_part.Expert && have_part.Grant) {
        // Add Grant as snippet to Expert
        // console.log(root_node);
        if (root_node['is-visible'] === true || root_node['is-visible'] === 'true') {
          logger.info(`${have_part.Expert.id} ==> ${have_part.Grant.id}`);
          {
            const node = {
              ...grantModel.snippet(have_part.Grant.node),
              ...this.snippet(root_node),
              '@type': 'Grantee',
            };
            delete node.relates;
            // console.log(`${have_part.Expert.id} Authored ${have_part.Grant.id}`);
            await expertModel.update_graph_node(have_part.Expert.id,node,root_node['is-visible']);
          }
        } else {
          logger.info(`${have_part.Expert.id} !=> ${have_part.Grant.id}`);
          await expertModel.delete_graph_node(have_part.Expert.id,root_node);
        }
      }
    }
  }
}
module.exports = GrantRoleModel;
