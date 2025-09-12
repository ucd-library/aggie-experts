const {BaseModel} = require('@ucd-lib/cork-app-utils');
const DagsterStore = require('../stores/DagsterStore');
const DagsterService = require('../services/DagsterService');

class DagsterModel extends BaseModel {

  constructor() {
    super();
    this.store = DagsterStore;
    this.service = DagsterService;

    this.register('DagsterModel');
  }

  /**
   * @method runJobPartition
   * @description run dagster job partition to update cdl
   *
   * @param {String} jobName dagster job name
   * @param {String} partitionName dagster partition name (cas)
   *
   * @returns {Promise} resolves to record
  */
  async runJobPartition(jobName, partitionName) {
    return await this.service.runJobPartition(jobName, partitionName);
  }

  /**
   * @method getLastRunForId
   * @description get last run for dagster job
   *
   * @param {String} runId dagster job id
   *
   * @returns {Promise} resolves to record
  */
  async getLastRunForId(runId) {
    return await this.service.getLastRunForId(runId);
  }

  /**
   * @method getLastRunForPartition
   * @description get last run for dagster job partition
   *
   * @param {String} jobName dagster job name
   * @param {String} partitionName dagster partition name (cas)
   *
   * @returns {Promise} resolves to record
  */
  async getLastRunForPartition(jobName, partitionName) {
    return await this.service.getLastRunForPartition(jobName, partitionName);
  }

}

module.exports = new DagsterModel();
