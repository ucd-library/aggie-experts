const {BaseModel} = require('@ucd-lib/cork-app-utils');
const BrowseByStore = require('../stores/BrowseByStore');
const BrowseByService = require('../services/BrowseByService');

class BrowseByModel extends BaseModel {

  constructor() {
    super();
    this.store = BrowseByStore;
    this.service = BrowseByService;

    this.register('BrowseByModel');
  }

  /**
   * @method browseExpertsAZ
   * @description search elastic search for available experts
   *
   * @returns {Promise} resolves to experts results per letter (last name)
   */
  async browseExpertsAZ() {
    return this.service.browseExpertsAZ();
  }

  /**
   * @method browseExperts
   * @description search elastic search for expert
   *
   * @param {String} lastInitial search letter, last name of expert
   * @param {Number} page page number, defaults to 1
   * @param {Number} size number of results per page, defaults to 25
   *
   * @returns {Promise} resolves to experts results
   */
  async browseExperts(lastInitial, page=1, size=25) {
    return this.service.browseExperts(lastInitial, page, size);
  }

}

module.exports = new BrowseByModel();
