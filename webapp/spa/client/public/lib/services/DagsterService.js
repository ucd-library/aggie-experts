const {BaseService} = require('@ucd-lib/cork-app-utils');
const DagsterStore = require('../stores/DagsterStore');

class DagsterService extends BaseService {

  constructor() {
    super();
    this.store = DagsterStore;

    this.baseUrl = '/api/harvest';
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

}

module.exports = new DagsterService();
