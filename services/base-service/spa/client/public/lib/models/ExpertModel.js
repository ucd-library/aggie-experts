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
   * @param {String} id expert id
   *
   * @returns {Promise} resolves to expert
   */
  async get(id) {
    let state = this.store.getExpert(id);

    if( state && state.request ) {
      await state.request;
    } else if( state && state.state === 'loaded' ) {
      if( state.id !== id ) {
        this.store.setExpertLoaded(id, state.payload)
      }
    } else {
      await this.service.get(id);
    }

    return this.store.getExpert(id);
  }

}

module.exports = new ExpertModel();
