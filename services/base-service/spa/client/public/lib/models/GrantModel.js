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
    let state = this.store.getGrant(id);

    if( state && state.request ) {
      await state.request;
    } else if( state && state.state === 'loaded' ) {
      if( state.id !== id ) {
        this.store.setGrantLoaded(id, state.payload)
      }
    } else {
      await this.service.get(id);
    }

    return this.store.getGrant(id);
  }

  /**
   * @method search
   * @description search for grant
   *
   * @param {Object} searchDocument es search document
   *
   * @returns {Promise} resolves to a grant search result
  */
  search(searchDocument) {
    return this.service.search(searchDocument);
  }

}

module.exports = new GrantModel();
