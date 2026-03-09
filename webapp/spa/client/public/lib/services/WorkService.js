const {BaseService} = require('@ucd-lib/cork-app-utils');
const WorkStore = require('../stores/WorkStore');
const payloadUtils = require('../payload.js').default;
const indexedDb = require('../utils/indexedDb.js');

class WorkService extends BaseService {

  constructor() {
    super();
    this.store = WorkStore;

    this.baseUrl = '/api/work';
  }

  async get(workId) {
    let ido = {workId};

    let qs = {};
    
    // if an admin and cache is saved for previewing an es index, use that
    let isAdmin = (APP_CONFIG.user?.roles || []).includes('admin') || false;
    let esIndexes = await indexedDb.getElasticsearchIndexes();
    let matchedAlias;
    if( esIndexes && esIndexes.filter(i => i.previewEsIndex).length > 0 ) {
      matchedAlias = esIndexes.find(i => i.previewEsIndex && i.indexName.startsWith('work'))?.aliases?.[0];
      if( matchedAlias && isAdmin ) {
        qs.previewEsIndex = matchedAlias;
        ido.previewEsIndex = matchedAlias;
      }
    }

    let id = payloadUtils.getKey(ido);

    await this.request({
      url : `${this.baseUrl}/${encodeURIComponent(workId)}`,
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

module.exports = new WorkService();
