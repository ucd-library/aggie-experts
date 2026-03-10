const {BaseService} = require('@ucd-lib/cork-app-utils');
const SearchStore = require('../stores/SearchStore');
const payloadUtils = require('../payload.js').default;
const indexedDb = require('../utils/indexedDb.js');

class SearchService extends BaseService {

  constructor() {
    super();
    this.store = SearchStore;

    this.baseUrl = '/api/search';
  }

  async search(searchQuery) {
    let ido = {};
    
    // if an admin and cache is saved for previewing an es index, use that
    let isAdmin = (APP_CONFIG.user?.roles || []).includes('admin') || false;
    let esIndexes = await indexedDb.getElasticsearchIndexes();
    if( esIndexes && esIndexes.filter(i => i.previewEsIndex).length > 0 ) {
      let previewIndexInfo = esIndexes.filter(i => i.previewEsIndex);
      let previewEsIndexExperts = previewIndexInfo.find(i => i.indexName?.startsWith('expert'))?.indexName;
      let previewEsIndexGrants = previewIndexInfo.find(i => i.indexName?.startsWith('grant'))?.indexName;
      let previewEsIndexWorks = previewIndexInfo.find(i => i.indexName?.startsWith('work'))?.indexName;
      if( previewEsIndexExperts && isAdmin ) searchQuery += `&previewEsIndexExperts=${previewEsIndexExperts}`;
      if( previewEsIndexGrants && isAdmin ) searchQuery += `&previewEsIndexGrants=${previewEsIndexGrants}`;
      if( previewEsIndexWorks && isAdmin ) searchQuery += `&previewEsIndexWorks=${previewEsIndexWorks}`;
  
      if( (previewEsIndexExperts || previewEsIndexGrants || previewEsIndexWorks) && isAdmin ) {
        ido.previewEsIndexExperts = previewEsIndexExperts;
        ido.previewEsIndexGrants = previewEsIndexGrants;
        ido.previewEsIndexWorks = previewEsIndexWorks;
      }
    }

    ido.search = searchQuery;
    let id = payloadUtils.getKey(ido);

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
