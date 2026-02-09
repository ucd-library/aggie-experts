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

}

module.exports = new SchemaModel();
