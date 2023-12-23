// Can use this to get the fin configuration
//const {config} = require('@ucd-lib/fin-service-utils');
const {config, models, logger, dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');

/**
 * @class GrantModel
 * @description Base class for Aggie Experts data models.
 */
class GrantModel extends BaseModel {

  static transformed_types = [ 'Grant' ];

  static types = [
    "http://schema.library.ucdavis.edu/schema#Grant"
  ];

  constructor(name='grant') {
    super(name);
  }

  /**
   * @method update
   * @description Update Elasticsearch with the given data.
   */
  async update(transformed) {
    const root_node= this.get_expected_model_node(transformed);
    const doc = this.promote_node_to_doc(root_node);
    logger.info(`${this.constructor.name}.update(${doc['@id']}) (NOOP)`);
  }
}
module.exports = GrantModel;
