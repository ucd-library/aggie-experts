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

  async browseAZBy(type, filters={}) {
    let url = `${this.baseUrl}/${type}/browse`;
    let qs = {};
    let ido = { browseAz: 'az', ...filters };

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

    if( filters.dept?.length ) qs.dept = filters.dept.join(',');
    if( filters.status?.length ) qs.status = filters.status.join(',');
    if( filters.type?.length ) qs.type = filters.type.join(',');
    if( filters.dateFrom ) qs.dateFrom = filters.dateFrom;
    if( filters.dateTo ) qs.dateTo = filters.dateTo;
    if( filters.availability?.length ) qs.availability = filters.availability.join(',');

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

  async browseCounts(type, lastInitial, filters={}) {
    let url = `${this.baseUrl}/${type}/browse`;
    let qs = { counts: 'true' };
    if( lastInitial ) qs.p = lastInitial.toUpperCase();
    let ido = { browseCounts: type, lastInitial, ...filters };

    let isAdmin = (APP_CONFIG.user?.roles || []).includes('admin') || false;
    let esIndexes = await indexedDb.getElasticsearchIndexes();
    if( esIndexes && esIndexes.filter(i => i.previewEsIndex).length > 0 ) {
      let indexInfo = esIndexes.find(i => i.previewEsIndex && i.indexName.startsWith(type));
      let matchedAlias = indexInfo?.aliases?.[0];
      let indexName = indexInfo?.indexName;
      if( ( matchedAlias || indexName ) && isAdmin ) {
        ido.previewEsIndex = matchedAlias || indexName;
        qs.previewEsIndex = matchedAlias || indexName;
      }
    }

    if( filters.dept?.length ) qs.dept = filters.dept.join(',');
    if( filters.status?.length ) qs.status = filters.status.join(',');
    if( filters.type?.length ) qs.type = filters.type.join(',');
    if( filters.dateFrom ) qs.dateFrom = filters.dateFrom;
    if( filters.dateTo ) qs.dateTo = filters.dateTo;

    type = type.substring(0, 1).toUpperCase() + type.substring(1);
    let storeKey = 'by'+type+'sCounts';

    let id = payloadUtils.getKey(ido);
    await this.request({
      url,
      qs,
      checkCached: () => this.store.data[storeKey].get(id),
      onUpdate: resp => this.store.set(
        payloadUtils.generate(ido, resp),
        this.store.data[storeKey]
      )
    });
    return this.store.data[storeKey].get(id);
  }

  /**
   * @method browseHistogram
   * @description fetch aggregations for the date histogram without a date filter,
   * so the slider always covers the full year range. Uses a separate store key
   * from browseBy so no browse-update events are emitted.
   * @param {String} type browse type (expert, grant, work)
   * @param {String} lastInitial letter to filter by
   * @param {Object} filters active non-date filters (dept, status, type, availability)
   * @returns {Promise}
   */
  async browseHistogram(type, lastInitial, filters={}) {
    const typeCapital = type.substring(0, 1).toUpperCase() + type.substring(1);
    const storeKey = 'by' + typeCapital + 'sHistogram';
    const ido = { browseHistogram: type, lastInitial, ...filters };

    let isAdmin = (APP_CONFIG.user?.roles || []).includes('admin') || false;
    let esIndexes = await indexedDb.getElasticsearchIndexes();
    if( esIndexes && esIndexes.filter(i => i.previewEsIndex).length > 0 ) {
      let indexInfo = esIndexes.find(i => i.previewEsIndex && i.indexName.startsWith(type));
      let matchedAlias = indexInfo?.aliases?.[0];
      let indexName = indexInfo?.indexName;
      if( ( matchedAlias || indexName ) && isAdmin ) {
        ido.previewEsIndex = matchedAlias || indexName;
      }
    }

    const qs = { page: 1, size: 0, p: lastInitial ? lastInitial.toUpperCase() : 'all' };
    if( filters.dept?.length ) qs.dept = filters.dept.join(',');
    if( filters.status?.length ) qs.status = filters.status.join(',');
    if( filters.type?.length ) qs.type = filters.type.join(',');
    if( filters.availability?.length ) qs.availability = filters.availability.join(',');

    const id = payloadUtils.getKey(ido);
    await this.request({
      url: `${this.baseUrl}/${type}/browse`,
      qs,
      checkCached: () => this.store.data[storeKey].get(id),
      onUpdate: resp => this.store.set(
        payloadUtils.generate(ido, resp),
        this.store.data[storeKey]
      )
    });
    return this.store.data[storeKey].get(id);
  }

  async browseBy(type, lastInitial, page=1, size=25, filters={}) {
    let ido = {browseType: type, lastInitial, page, size, ...filters};

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

    let qs = { page, size, p: lastInitial ? lastInitial.toUpperCase() : 'all' };
    if( ( matchedAlias || indexName ) && isAdmin ) {
      qs.previewEsIndex = matchedAlias || indexName;
      ido.previewEsIndex = matchedAlias || indexName;
    }

    if( filters.dept?.length ) qs.dept = filters.dept.join(',');
    if( filters.status?.length ) qs.status = filters.status.join(',');
    if( filters.type?.length ) qs.type = filters.type.join(',');
    if( filters.dateFrom ) qs.dateFrom = filters.dateFrom;
    if( filters.dateTo ) qs.dateTo = filters.dateTo;
    if( filters.availability?.length ) qs.availability = filters.availability.join(',');

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
