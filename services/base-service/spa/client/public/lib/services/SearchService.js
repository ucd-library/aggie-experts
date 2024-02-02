const {BaseService} = require('@ucd-lib/cork-app-utils');
const SearchStore = require('../stores/SearchStore');

class SearchService extends BaseService {

  constructor() {
    super();
    this.store = SearchStore;

    this.baseUrl = '/api/search';
  }

  search(searchTerm, page=1, size=25) {
    return this.request({
      url : `${this.baseUrl}?q=${searchTerm}&page=${page}&size=${size}`,
      checkCached : () => this.store.search(searchTerm),
      onLoading : request => this.store.setSearchLoading(searchTerm, request),
      onLoad : result => this.store.setSearchLoaded(searchTerm, result.body),
      onError : e => this.store.setSearchError(searchTerm, e)
    });
  }

}

module.exports = new SearchService();
