const {BaseService} = require('@ucd-lib/cork-app-utils');
const ExpertStore = require('../stores/ExpertStore');
const payloadUtils = require('../payload.js').default;

class ExpertService extends BaseService {

  constructor() {
    super();
    this.store = ExpertStore;

    this.baseUrl = '/api';
  }

  async get(expertId, subpage, options={}, clearCache=false) {
    let ido = { expertId, subpage };
    let id = payloadUtils.getKey(ido);

    await this.request({
      url : `${this.baseUrl}/${expertId}`,
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
      url : `${this.baseUrl}/${id}/${encodeURIComponent(citationId)}`,
      fetchOptions : {
        method : 'PATCH',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
          "@id" : citationId,
          "visible" : visible
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
      url : `${this.baseUrl}/${id}/${encodeURIComponent(citationId)}`,
      fetchOptions : {
        method : 'DELETE'
      },
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

  async updateGrantVisibility(id, grantId, visible) {
    return this.request({
      url : `${this.baseUrl}/${id}/${encodeURIComponent(grantId)}`,
      fetchOptions : {
        method : 'PATCH',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
          "@id" : grantId,
          "visible" : visible,
          "grant" : true
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
      url : `${this.baseUrl}/${id}`,
      fetchOptions : {
        method : 'PATCH',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
          "@id" : id,
          "visible" : visible
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
      url : `${this.baseUrl}/${id}`,
      fetchOptions : {
        method : 'DELETE',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
          "@id" : id,
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
      url : `${this.baseUrl}/${id}/availability`,
      fetchOptions : {
        method : 'PATCH',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({
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
