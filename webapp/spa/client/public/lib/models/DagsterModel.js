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

  /**
   * @method getHealth
   * @description get health of dagster instance
   *
   * @returns {Promise} resolves to record
  */
  async getHealth() {
    return await this.service.getHealth();
  }

  /**
   * @method updateCitationVisibility
   * @description update visibility of experts work
   *
   * @param {String} id expert id
   * @param {String} citationId id of work
   * @param {Boolean} visible true if visible
   *
   * @returns {Promise} resolves to record
   */
  async updateCitationVisibility(id, citationId, visible=false) {
    // remove /relationship from the citationId
    citationId = citationId.replace('/relationship', '');
    return await this.service.updateCitationVisibility(id, citationId, visible);
  }

  /**
   * @method rejectCitation
   * @description remove citation from expert
   *
   * @param {String} id expert id
   * @param {String} citationId id of work
   *
   * @returns {Promise} resolves to record
   */
  async rejectCitation(id, citationId) {
    citationId = citationId.replace('/relationship', '');
    return await this.service.rejectCitation(id, citationId);
  }

  /**
   * @method updateCitationFavourite
   * @description update favourite status of experts work
   *
   * @param {String} id expert id
   * @param {String} citationId id of work
   * @param {Boolean} favourite true if favourite
   *
   * @returns {Promise} resolves to record
   */
  updateCitationFavourite(id, citationId, favourite=false) {
    // remove /relationship from the citationId
    citationId = citationId.replace('/relationship', '');
    return this.service.updateCitationFavourite(id, citationId, favourite);
  }

  /**
   * @method updateGrantVisibility
   * @description update visibility of experts grant
   *
   * @param {String} id expert id
   * @param {String} grantId id of grant
   * @param {Boolean} visible true if visible
   *
   * @returns {Promise} resolves to record
   */
  async updateGrantVisibility(id, grantId, visible=false) {
    return await this.service.updateGrantVisibility(id, grantId, visible);
  }

  /**
   * @method updateExpertVisibility
   * @description update visibility of an expert
   *
   * @param {String} id expert id
   * @param {Boolean} visible true if visible
   *
   * @returns {Promise} resolves to record
   */
  async updateExpertVisibility(id, visible=false) {
    return await this.service.updateExpertVisibility(id, visible);
  }

  /**
   * @method deleteExpert
   * @description delete expert from aggie experts and cdl
   *
   * @param {String} id expert id
   *
   * @returns {Promise} resolves to record
  */
  async deleteExpert(id) {
    return await this.service.deleteExpert(id);
  }

  /**
   * @method updateExpertAvailability
   * @description update an experts availability in aggie experts and cdl
   *
   * @param {String} id expert id
   * @param {Object} labels object with labels to add and remove
   *
   * @returns {Promise} resolves to record
  */
  async updateExpertAvailability(id, labels={}) {
    return await this.service.updateExpertAvailability(id, labels);
  }

}

module.exports = new DagsterModel();
