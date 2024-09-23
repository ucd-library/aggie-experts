const {BaseService} = require('@ucd-lib/cork-app-utils');
const SearchStore = require('../stores/SearchStore');

class SearchService extends BaseService {

  constructor() {
    super();
    this.store = SearchStore;

    this.baseUrl = '/api/search';
  }

  async search(searchQuery) {
    let id = 'search:'+searchQuery;
    let ido = { search : searchQuery };

    await this.request({
      url : `${this.baseUrl}?${searchQuery}`,
      checkCached : () => this.store.data.bySearchQuery.get(id),
      onLoading : request => this.store.onSearchUpdate(ido, {request}),
      onLoad : payload => this.store.onSearchUpdate(ido, {payload: payload.body}),
      onError : error => this.store.onSearchUpdate(ido, {error})
    });

    return this.store.data.bySearchQuery.get(id);
  }

}

module.exports = new SearchService();
