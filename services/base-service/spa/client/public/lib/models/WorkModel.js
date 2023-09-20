const {BaseModel} = require('@ucd-lib/cork-app-utils');
const WorkStore = require('../stores/WorkStore');
const WorkService = require('../services/WorkService');

class WorkModel extends BaseModel {

  constructor() {
    super();
    this.store = WorkStore;
    this.service = WorkService;

    this.register('WorkModel');
  }

  /**
   * @method get
   * @description load a work by id from elastic search
   *
   * @param {String} id record id
   *
   * @returns {Promise} resolves to record
   */
  async get(id) {
    let state = this.store.getWork(id);

    if( state && state.request ) {
      await state.request;
    } else if( state && state.state === 'loaded' ) {
      if( state.id !== id ) {
        this.store.setWorkLoaded(id, state.payload)
      }
    } else {
      await this.service.get(id);
    }

    return this.store.getWork(id);
  }

  /**
   * @method search
   * @description search for work
   *
   * @param {Object} searchDocument es search document
   *
   * @returns {Promise} resolves to a work search result
  */
  search(searchDocument) {
    return this.service.search(searchDocument);
  }

}

module.exports = new WorkModel();
