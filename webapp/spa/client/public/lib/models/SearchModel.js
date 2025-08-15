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
   * @param {String} searchQuery search url
   *
   * @returns {Promise} resolves to expert
   */
  async search(searchQuery) {
    return this.service.search(searchQuery);
  }

}

module.exports = new SearchModel();
