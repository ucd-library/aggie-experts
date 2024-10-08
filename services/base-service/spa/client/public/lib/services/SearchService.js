const {BaseService} = require('@ucd-lib/cork-app-utils');
const SearchStore = require('../stores/SearchStore');
const payloadUtils = require('../payload.js').default;

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
      onUpdate : resp => this.store.set(
        payloadUtils.generate(ido, resp),
        this.store.data.bySearchQuery
      )
    });

    return this.store.data.bySearchQuery.get(id);
  }

}

module.exports = new SearchService();
