const {BaseService} = require('@ucd-lib/cork-app-utils');
const GrantStore = require('../stores/GrantStore');
const payloadUtils = require('../payload.js').default;

class GrantService extends BaseService {

  constructor() {
    super();
    this.store = GrantStore;

    this.baseUrl = '/api/grant';
  }

  async get(grantId) {
    let ido = {grantId};
    let id = payloadUtils.getKey(ido);

    await this.request({
      url : `${this.baseUrl}/${encodeURIComponent(grantId)}`,
      checkCached : () => this.store.data.byId.get(id),
      onUpdate : resp => this.store.set(
        payloadUtils.generate(ido, resp),
        this.store.data.byId
      )
    });

    return this.store.data.byId.get(id);
  }

}

module.exports = new GrantService();
