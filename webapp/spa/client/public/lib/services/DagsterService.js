const {BaseService} = require('@ucd-lib/cork-app-utils');
const DagsterStore = require('../stores/DagsterStore');

class DagsterService extends BaseService {

  constructor() {
    super();
    this.store = DagsterStore;

    this.baseUrl = '/api/harvest';
    this.adminUpdatesUrl = '/api/harvest/admin-updates';
  }

  async runJobPartition(jobName, partitionName) {
    return this.request({
      url : `${this.baseUrl}/run-job-partition`,
      fetchOptions : {
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({ partition: partitionName, jobName })
      },
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

  async getLastRunForId(runId) {
    return this.request({
      url : `${this.baseUrl}/run/${runId}`,
      fetchOptions : {
        method : 'GET',
        headers : {
          'Content-Type' : 'application/json'
        }
      },
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
  }

  async getLastRunForPartition(jobName, partitionName) {
    return this.request({
      url : `${this.baseUrl}/last-runs-for-partition`,
      fetchOptions : {
        method : 'POST',
        headers : {
          'Content-Type' : 'application/json'
        },
        body : JSON.stringify({ partition: partitionName, jobName })
      },
      checkCached : () => null,
      onLoading : null,
      onLoad : null,
      onError : null
    });
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

module.exports = new DagsterService();
