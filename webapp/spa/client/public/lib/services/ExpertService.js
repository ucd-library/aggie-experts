const {BaseService} = require('@ucd-lib/cork-app-utils');
const ExpertStore = require('../stores/ExpertStore');
const payloadUtils = require('../payload.js').default;
const indexedDb = require('../utils/indexedDb.js');

class ExpertService extends BaseService {

  constructor() {
    super();
    this.store = ExpertStore;

    this.baseUrl = '/api';
    this.adminUpdatesUrl = '/api/harvest/admin-updates';
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

  async updateCitationVisibility(id, citationId, visible) {
    return this.request({
      url : `${this.adminUpdatesUrl}/scholarly-record`,
      fetchOptions : {
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
          expertId : id,
          relationshipId : citationId,
          type : 'work',
          visibility : visible ? 'yes' : 'no'
        })
      },
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

  async rejectCitation(id, citationId) {
    return this.request({
      url : `${this.adminUpdatesUrl}/scholarly-record`,
      fetchOptions : {
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
          expertId : id,
          relationshipId : citationId,
          type : 'work',
          reject : 'yes'
        })
      },
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

  async updateCitationFavourite(id, citationId, favourite) {
    return this.request({
      url : `${this.adminUpdatesUrl}/scholarly-record`,
      fetchOptions : {
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
          expertId : id,
          relationshipId : citationId,
          type : 'work',
          favorite : favourite ? 'yes' : 'no'
        })
      },
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

  async updateGrantVisibility(id, grantId, visible) {
    return this.request({
      url : `${this.adminUpdatesUrl}/scholarly-record`,
      fetchOptions : {
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
          expertId : id,
          relationshipId : grantId,
          type : 'grant',
          visibility : visible ? 'yes' : 'no'
        })
      },
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

  async updateExpertVisibility(id, visible) {
    return this.request({
      url : `${this.adminUpdatesUrl}/expert`,
      fetchOptions : {
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
          expertId : id,
          visibility : visible ? 'yes' : 'no'
        })
      },
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

  async deleteExpert(id) {
    return this.request({
      url : `${this.adminUpdatesUrl}/expert`,
      fetchOptions : {
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
          expertId : id,
          delete : 'yes'
        })
      },
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

  async updateExpertAvailability(id, labels={}) {
    return this.request({
      url : `${this.adminUpdatesUrl}/expert-availability`,
      fetchOptions : {
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
          expertId : id,
          labelsToAddOrEdit : labels.labelsToAddOrEdit || [],
          labelsToRemove : labels.labelsToRemove || [],
          currentLabels : labels.currentLabels || []
        })
      },
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

}

module.exports = new ExpertService();
