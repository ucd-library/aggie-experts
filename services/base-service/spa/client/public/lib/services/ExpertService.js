const {BaseService} = require('@ucd-lib/cork-app-utils');
const ExpertStore = require('../stores/ExpertStore');

class ExpertService extends BaseService {

  constructor() {
    super();
    this.store = ExpertStore;

    this.baseUrl = '/api';
  }

  get(id, subpage, options={}) {
    return this.request({
      url : `${this.baseUrl}/${id}`,
      fetchOptions : {
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify(options)
      },
      checkCached : () => this.store.getExpert(id+subpage),
      onLoading : request => this.store.setExpertLoading(id+subpage, request),
      onLoad : result => this.store.setExpertLoaded(id+subpage, result.body),
      onError : e => this.store.setExpertError(id+subpage, e)
    });
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
