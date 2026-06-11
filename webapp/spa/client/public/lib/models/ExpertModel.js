const {BaseModel} = require('@ucd-lib/cork-app-utils');
const ExpertStore = require('../stores/ExpertStore');
const ExpertService = require('../services/ExpertService');

class ExpertModel extends BaseModel {

  constructor() {
    super();
    this.store = ExpertStore;
    this.service = ExpertService;

    this.register('ExpertModel');
  }

  /**
   * @method get
   * @description load a expert by id from elastic search
   *
   * @param {String} expertId expert id
   * @param {String} subpage subpage of expert, ie works or grants list/edit pages
   * @param {Object} options for request
   * @param {Boolean} clearCache true to clear cache
   *
   * @returns {Promise} resolves to expert
   */
  async get(expertId, subpage='', options={}, clearCache=false) {
    return this.service.get(expertId, subpage, options, clearCache);
  }

}

module.exports = new ExpertModel();
