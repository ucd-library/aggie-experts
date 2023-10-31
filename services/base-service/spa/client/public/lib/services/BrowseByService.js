const {BaseService} = require('@ucd-lib/cork-app-utils');
const BrowseByStore = require('../stores/BrowseByStore');

class BrowseByService extends BaseService {

  constructor() {
    super();
    this.store = BrowseByStore;

    this.baseUrl = '/api/browse';
  }

  browseAZ() {
    return this.request({
      url : `${this.baseUrl}`,
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

  browseExperts(lastInitial, page=1, size=25) {
    return this.request({
      url : `${this.baseUrl}?p=${lastInitial.toUpperCase()}&page=${page}&size=${size}`,
      checkCached : () => this.store.browseExperts(lastInitial),
      onLoading : request => this.store.setBrowseExpertsLoading(lastInitial, request),
      onLoad : result => this.store.setBrowseExpertsLoaded(lastInitial, result.body),
      onError : e => this.store.setBrowseExpertsError(lastInitial, e)
    });
  }

}

module.exports = new BrowseByService();
