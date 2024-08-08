const {BaseService} = require('@ucd-lib/cork-app-utils');
const GrantStore = require('../stores/GrantStore');

class GrantService extends BaseService {

  constructor() {
    super();
    this.store = GrantStore;

    this.baseUrl = '/api/grant';
  }

  get(id) {
    return this.request({
      url : `${this.baseUrl}/${encodeURIComponent(id)}`,
      checkCached : () => this.store.getGrant(id),
      onLoading : request => this.store.setGrantLoading(id, request),
      onLoad : result => this.store.setGrantLoaded(id, result.body),
      onError : e => this.store.setGrantError(id, e)
    });
  }

}

module.exports = new GrantService();
