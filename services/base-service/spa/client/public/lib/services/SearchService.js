const {BaseService} = require('@ucd-lib/cork-app-utils');
const SearchStore = require('../stores/SearchStore');

class SearchService extends BaseService {

  constructor() {
    super();
    this.store = SearchStore;

    this.baseUrl = '/api/search';
  }

  search(searchQuery) {
    return this.request({
      url : `${this.baseUrl}?${searchQuery}`,
      checkCached : () => this.store.search(searchQuery),
      onLoading : request => this.store.setSearchLoading(searchQuery, request),
      onLoad : result => this.store.setSearchLoaded(searchQuery, result.body),
      onError : e => this.store.setSearchError(searchQuery, e)
    });
  }

}

module.exports = new SearchService();
