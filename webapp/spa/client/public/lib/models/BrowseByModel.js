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
   * @method browseAZBy
   * @description search elastic search for available experts
   *
   * @returns {Promise} resolves to experts results per letter (last name)
   */
  async browseAZBy(type='expert') {
    return this.service.browseAZBy(type);
  }

  /**
   * @method browseBy
   * @description search elastic search for expert
   *
   * @param {String} type search type, defaults to 'expert'
   * @param {String} lastInitial search letter, last name of expert
   * @param {Number} page page number, defaults to 1
   * @param {Number} size number of results per page, defaults to 25
   *
   * @returns {Promise} resolves to experts results
   */
  async browseBy(type='expert', lastInitial, page=1, size=25) {
    return this.service.browseBy(type, lastInitial, page, size);
  }

}

module.exports = new BrowseByModel();
