const {BaseService} = require('@ucd-lib/cork-app-utils');
const GrantStore = require('../stores/GrantStore');
const payloadUtils = require('../payload.js').default;
const indexedDb = require('../utils/indexedDb.js');

class GrantService extends BaseService {

  constructor() {
    super();
    this.store = GrantStore;

    this.baseUrl = '/api/grant';
  }

  async get(grantId) {
    let ido = {grantId};
    let qs = {};
        
    // if an admin and cache is saved for previewing an es index, use that
    let isAdmin = (APP_CONFIG.user?.roles || []).includes('admin') || false;
    let esIndexes = await indexedDb.getElasticsearchIndexes();
    let matchedAlias;
    if( esIndexes && esIndexes.filter(i => i.previewEsIndex).length > 0 ) {
      matchedAlias = esIndexes.find(i => i.previewEsIndex && i.aliasName.startsWith('grant'))?.aliasName;
      if( matchedAlias && isAdmin ) {
        qs.previewEsIndex = matchedAlias;
        ido.previewEsIndex = matchedAlias;
      }
    }

    let id = payloadUtils.getKey(ido);

    await this.request({
      url : `${this.baseUrl}/${encodeURIComponent(grantId)}`,
      qs,
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
