const {BaseService} = require('@ucd-lib/cork-app-utils');
const BrowseByStore = require('../stores/BrowseByStore');
const payloadUtils = require('../payload.js').default;
const indexedDb = require('../utils/indexedDb.js');

class BrowseByService extends BaseService {

  constructor() {
    super();
    this.store = BrowseByStore;

    this.baseUrl = '/api';
  }

  async browseAZBy(type) {
    let url = `${this.baseUrl}/${type}/browse`;
    let qs = {};
    let ido = { browseAz: 'az' };

    // if an admin and cache is saved for previewing an es index, use that
    let isAdmin = (APP_CONFIG.user?.roles || []).includes('admin') || false;
    let esIndexes = await indexedDb.getElasticsearchIndexes();
    let matchedAlias, indexName;

    if( esIndexes && esIndexes.filter(i => i.previewEsIndex).length > 0 ) {
      let indexInfo = esIndexes.find(i => i.previewEsIndex && i.indexName.startsWith(type));
      matchedAlias = indexInfo?.aliases?.[0];
      indexName = indexInfo?.indexName;
      
      if( ( matchedAlias || indexName ) && isAdmin ) {
        ido.previewEsIndex = matchedAlias || indexName;
        qs.previewEsIndex = matchedAlias || indexName;
      }
    }

    type = type.substring(0, 1).toUpperCase() + type.substring(1);

    let storeKey = 'by'+type+'sAZ';
    ido['browse'+type+'s'] = 'az';
    let id = payloadUtils.getKey(ido);
    
    await this.request({
      url,
      qs,
      checkCached : () => this.store.data[storeKey].get(id),
      onUpdate : resp => this.store.set(
        payloadUtils.generate(ido, resp),
        this.store.data[storeKey]
      )
    });

    return this.store.data[storeKey].get(id);
  }

  async browseBy(type, lastInitial, page=1, size=25) {
    let ido = {browseType: type, lastInitial, page, size};

    // if an admin and cache is saved for previewing an es index, use that
    let isAdmin = (APP_CONFIG.user?.roles || []).includes('admin') || false;
    let esIndexes = await indexedDb.getElasticsearchIndexes();
    let matchedAlias, indexName;
    if( esIndexes && esIndexes.filter(i => i.previewEsIndex).length > 0 ) {
      let indexInfo = esIndexes.find(i => i.previewEsIndex && i.indexName.startsWith(type));
      matchedAlias = indexInfo?.aliases?.[0];
      indexName = indexInfo?.indexName;
    }

    type = type.substring(0, 1).toUpperCase() + type.substring(1);
    let storeKey = 'by'+type+'sLastInitial';

    let qs = { page, size, p : lastInitial.toUpperCase() };
    if( ( matchedAlias || indexName ) && isAdmin ) {
      qs.previewEsIndex = matchedAlias || indexName;
      ido.previewEsIndex = matchedAlias || indexName;
    }

    let id = payloadUtils.getKey(ido); 
    await this.request({
      url : `${this.baseUrl}/${type.toLowerCase()}/browse`,
      qs,
      checkCached : () => this.store.data[storeKey].get(id),
      onUpdate : resp => this.store.set(
        payloadUtils.generate(ido, resp),
        this.store.data[storeKey]
      )
    });

    return this.store.data[storeKey].get(id);
  }

}

module.exports = new BrowseByService();
