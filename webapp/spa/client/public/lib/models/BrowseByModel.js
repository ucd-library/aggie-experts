const {BaseModel} = require('@ucd-lib/cork-app-utils');
const BrowseByStore = require('../stores/BrowseByStore');
const BrowseByService = require('../services/BrowseByService');

class BrowseByModel extends BaseModel {

  constructor() {
    super();
    this.store = BrowseByStore;
    this.service = BrowseByService;

    this.register('BrowseByModel');
  }

  /**
   * @method browseAZBy
   * @description search elastic search for available experts
   *
   * @returns {Promise} resolves to experts results per letter (last name)
   */
  async browseAZBy(type='expert', filters={}) {
    return this.service.browseAZBy(type, filters);
  }

  /**
   * @method browseBy
   * @description search elastic search for expert
   *
   * @param {String} type search type, defaults to 'expert'
   * @param {String} lastInitial search letter, last name of expert
   * @param {Number} page page number, defaults to 1
   * @param {Number} size number of results per page, defaults to 25
   *
   * @returns {Promise} resolves to experts results
   */
  async browseBy(type='expert', lastInitial, page=1, size=25, filters={}) {
    return this.service.browseBy(type, lastInitial, page, size, filters);
  }

  /**
   * @method browseHistogram
   * @description fetch date histogram aggregations without a date filter so the
   * range slider always shows the full available year range
   * @param {String} type browse type (expert, grant, work)
   * @param {String} lastInitial letter to filter by
   * @param {Object} filters active non-date filters
   * @returns {Promise}
   */
  async browseHistogram(type='work', lastInitial, filters={}) {
    return this.service.browseHistogram(type, lastInitial, filters);
  }

  async browseCounts(type='grant', lastInitial, filters={}) {
    return this.service.browseCounts(type, lastInitial, filters);
  }

}

module.exports = new BrowseByModel();
