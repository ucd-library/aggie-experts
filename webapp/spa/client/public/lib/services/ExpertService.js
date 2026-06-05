const {BaseService} = require('@ucd-lib/cork-app-utils');
const ExpertStore = require('../stores/ExpertStore');
const payloadUtils = require('../payload.js').default;
const indexedDb = require('../utils/indexedDb.js');

class ExpertService extends BaseService {

  constructor() {
    super();
    this.store = ExpertStore;

    this.baseUrl = '/api';
  }

  async get(expertId, subpage, options={}, clearCache=false) {
    let ido = { expertId, subpage };
    let qs = {};

    // if an admin and cache is saved for previewing an es index, use that
    let isAdmin = (APP_CONFIG.user?.roles || []).includes('admin') || false;
    let esIndexes = await indexedDb.getElasticsearchIndexes();
    let matchedAlias, indexName;
    if( esIndexes && esIndexes.filter(i => i.previewEsIndex).length > 0 ) {
      let indexInfo = esIndexes.find(i => i.previewEsIndex && i.indexName.startsWith('expert'));
      matchedAlias = indexInfo?.aliases?.[0];
      indexName = indexInfo?.indexName;
      if( ( matchedAlias || indexName ) && isAdmin ) {
        qs.previewEsIndex = matchedAlias || indexName;
        ido.previewEsIndex = matchedAlias || indexName;
      }
    }

    let id = payloadUtils.getKey(ido);

    await this.request({
      url : `${this.baseUrl}/${expertId}`,
      qs,
      fetchOptions : {
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify(options)
      },
      checkCached : () => {
        if( clearCache ) return;

        return this.store.data.byId.get(id);
      },
      onUpdate : resp => this.store.set(
        payloadUtils.generate(ido, resp),
        this.store.data.byId
      )
    });

    return this.store.data.byId.get(id);
  }

}

module.exports = new ExpertService();
