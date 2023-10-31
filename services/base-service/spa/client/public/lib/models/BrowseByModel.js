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
   * @method browseAZ
   * @description search elastic search for available experts
   *
   * @returns {Promise} resolves to experts results
   */
  async browseAZ() {
    return await this.service.browseAZ();
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
    let state = this.store.browseExperts(lastInitial, page, size);

    if( state && state.request ) {
      await state.request;
    } else if( state && state.state === 'loaded' ) {
      if( state.lastInitial !== lastInitial ) {
        this.store.setBrowseExpertsLoaded(lastInitial, state.payload)
      }
    } else {
      await this.service.browseExperts(lastInitial, page, size);
    }

    return this.store.browseExperts(lastInitial, page, size);
  }

}

module.exports = new BrowseByModel();
