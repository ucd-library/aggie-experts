const {BaseModel} = require('@ucd-lib/cork-app-utils');
const GrantStore = require('../stores/GrantStore');
const GrantService = require('../services/GrantService');

class GrantModel extends BaseModel {

  constructor() {
    super();
    this.store = GrantStore;
    this.service = GrantService;

    this.register('GrantModel');
  }

  /**
   * @method get
   * @description load a grant by id from elastic search
   *
   * @param {String} id record id
   *
   * @returns {Promise} resolves to record
   */
  async get(id) {
    return this.service.get(id);
  }

}

module.exports = new GrantModel();
