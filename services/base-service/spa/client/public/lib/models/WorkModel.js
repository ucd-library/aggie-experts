const {BaseModel} = require('@ucd-lib/cork-app-utils');
const WorkStore = require('../stores/WorkStore');
const WorkService = require('../services/WorkService');

class WorkModel extends BaseModel {

  constructor() {
    super();
    this.store = WorkStore;
    this.service = WorkService;

    this.register('WorkModel');
  }

  /**
   * @method get
   * @description load a work by id from elastic search
   *
   * @param {String} id record id
   *
   * @returns {Promise} resolves to record
   */
  async get(id) {
    return this.service.get(id);
  }

}

module.exports = new WorkModel();
