const {BaseModel} = require('@ucd-lib/cork-app-utils');
const SchemaStore = require('../stores/SchemaStore');
const SchemaService = require('../services/SchemaService');

class SchemaModel extends BaseModel {

  constructor() {
    super();
    this.store = SchemaStore;
    this.service = SchemaService;

    this.register('SchemaModel');
  }

  /**
   * @method getIndexes
   * @description load available indexes/aliases from elastic search
   *
   * @returns {Promise} resolves to record
   */
  async getIndexes() {
    return this.service.getIndexes();
  }

  /**
   * @method setAlias
   * @description set an alias for an index in elastic search
   *
   * @param {Array} indexesToSwitch - array of objects with indexName and aliasName properties
   * @returns {Promise} resolves to record
   */
  async setAlias(indexesToSwitch) {
    return this.service.setAlias(indexesToSwitch);
  }

}

module.exports = new SchemaModel();
