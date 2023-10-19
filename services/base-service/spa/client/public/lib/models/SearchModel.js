const {BaseModel} = require('@ucd-lib/cork-app-utils');
const SearchStore = require('../stores/SearchStore');
const SearchService = require('../services/SearchService');

class SearchModel extends BaseModel {

  constructor() {
    super();
    this.store = SearchStore;
    this.service = SearchService;

    this.register('SearchModel');
  }

  /**
   * @method search
   * @description search elastic search
   *
   * @param {String} searchTerm search term
   * @param {Number} page page number, defaults to 1
   * @param {Number} size number of results per page, defaults to 10
   *
   * @returns {Promise} resolves to expert
   */
  async search(searchTerm, page=1, size=10) {
    let state = this.store.search(searchTerm, page, size);

    if( state && state.request ) {
      await state.request;
    } else if( state && state.state === 'loaded' ) {
      if( state.searchTerm !== searchTerm ) {
        this.store.setSearchLoaded(searchTerm, state.payload)
      }
    } else {
      await this.service.search(searchTerm, page, size);
    }

    return this.store.search(searchTerm, page, size);
  }

}

module.exports = new SearchModel();
