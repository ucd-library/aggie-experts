// Can use this to get the fin configuration
const {config, models } = require('@ucd-lib/fin-service-utils');
//const FinEsNestedModel = require('../experts/fin-es-nested-model');
const ExpertsModel = require('../experts/model.js');

/**
 * @class ExpertsModel
 * @description Base class for Aggie Experts data models.
 */
class HomeModel extends ExpertsModel {

  constructor(name='home') {
    super(name);
  }

  /**
   * @method is
   * @description Determines if this model can handle the given file based on
   * it's type.
   */
  is(id,types,workflows) {
    return false;
  }


}
module.exports = HomeModel;
