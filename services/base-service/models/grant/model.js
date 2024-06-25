const {config, models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');

/**
 * @class GrantModel
 * @description Base class for Aggie Experts data models.
 */
class GrantModel extends BaseModel {

  static transformed_types = [ 'Grant' ];

  static types = [
    "http://vivoweb.org/ontology/core#Grant"
  ];

  constructor(name='grant') {
    super(name);
  }

  snippet(node) {
    let snip=super.snippet(node);
    return snip;
  }

  /**
   * @method update
   * @description Update Elasticsearch with the given data.
   */
  async update(transformed) {
    const root_node= this.get_expected_model_node(transformed);
    const doc = this.promote_node_to_doc(root_node);

    const grantRoleModel=await this.get_model('grant_role');
    const expertModel=await this.get_model('expert');

    // Update all GrantRole with this grant as well
    let grantRole = grantRoleModel.get_expected_model_node(transformed);

    let relates=grantRole.relates.filter(x => x !== doc['@id']);

    if (relates.length != 1) {
      // console.log("ERROR: doc['@id']="+doc['@id']+" relates="+JSON.stringify(relates));
      throw new Error(`Expected 1 relates, got ${relates.length}`);
    }
    const expert_id=relates[0];
    let expert=await expertModel.client_get(expert_id);
    expert=expertModel.get_expected_model_node(expert);
    const role = {
      ...expertModel.snippet(expert),
      ...grantRoleModel.snippet(grantRole),
      '@type': 'GrantRole',
    };
    delete role.relates;
    delete role['@id'];
    // Role(expert) is added/delete to Grant
    await this.update_or_create_main_node_doc(doc);
    await this.update_graph_node(doc['@id'],role);

    // Now determine visibility of the grant itself
    try {
      let grant=await this.client_get(doc['@id']);
      const grant_node=this.get_expected_model_node(grant);
      grant_node["is-visible"]=false;
      const authors=this.get_nodes_by_type(grant,'GrantRole');
      for (let i=0; i<authors.length; i++) {
        if (authors[i]['is-visible']) {
          grant_node["is-visible"]=true;
          break;
        }
      }
    } catch (e) {
      logger.info(`${doc["@id"]} visibility error`);
     }

  }
}
module.exports = GrantModel;
