const {BaseModel} = require('@ucd-lib/cork-app-utils');
const PersonStore = require('../stores/PersonStore');
const PersonService = require('../services/PersonService');

class PersonModel extends BaseModel {

  constructor() {
    super();
    this.store = PersonStore;
    this.service = PersonService;

    this.register('PersonModel');
  }

  /**
   * @method get
   * @description load a person by id from elastic search
   *
   * @param {String} id person id
   *
   * @returns {Promise} resolves to person
   */
  async get(id) {
    let state = this.store.getPerson(id);

    if( state && state.request ) {
      await state.request;
    } else if( state && state.state === 'loaded' ) {
      if( state.id !== id ) {
        this.store.setPersonLoaded(id, state.payload)
      }
    } else {
      await this.service.get(id);
    }

    return this.store.getPerson(id);
  }

}

module.exports = new PersonModel();
