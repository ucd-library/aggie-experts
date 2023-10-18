// Can use this to get the fin configuration
//const {config} = require('@ucd-lib/fin-service-utils');
const ExpertsModel = require('../experts/model.js');

/**
 * @class GrantModel
 * @description Base class for Aggie Experts data models.
 */
class GrantModel extends ExpertsModel {

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
  async update(jsonld) {
    throw new Error('GrantModel.update() not implemented');
  }
}
module.exports = GrantModel;
