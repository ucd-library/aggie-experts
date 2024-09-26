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
   * @param {Number} size number of results per page, defaults to 25
   * @param {Array} hasAvailability array of availability filters
   *
   * @returns {Promise} resolves to expert
   */
  async search(searchTerm, page=1, size=25, hasAvailability=[]) {
    let searchQuery = `q=${searchTerm}&page=${page}&size=${size}&hasAvailability=${encodeURIComponent(hasAvailability)}`;

    return this.service.search(searchQuery);
  }

}

module.exports = new SearchModel();
