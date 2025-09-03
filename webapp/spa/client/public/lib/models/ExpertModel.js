const {BaseModel} = require('@ucd-lib/cork-app-utils');
const ExpertStore = require('../stores/ExpertStore');
const ExpertService = require('../services/ExpertService');

class ExpertModel extends BaseModel {

  constructor() {
    super();
    this.store = ExpertStore;
    this.service = ExpertService;

    this.register('ExpertModel');
  }

  /**
   * @method get
   * @description load a expert by id from elastic search
   *
   * @param {String} expertId expert id
   * @param {String} subpage subpage of expert, ie works or grants list/edit pages
   * @param {Object} options for request
   * @param {Boolean} clearCache true to clear cache
   *
   * @returns {Promise} resolves to expert
   */
  async get(expertId, subpage='', options={}, clearCache=false) {
    return this.service.get(expertId, subpage, options, clearCache);
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

module.exports = new ExpertModel();
