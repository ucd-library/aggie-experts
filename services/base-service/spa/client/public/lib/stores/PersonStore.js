var {BaseStore} = require('@ucd-lib/cork-app-utils');

class PersonStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      byId : {},
      overview : {
        state : this.STATE.INIT
      },
      search : {
        state : this.STATE.INIT
      }
    }

    this.events = {
      PERSON_UPDATE : 'person-update',
      PERSON_SEARCH_UPDATE : 'person-search-update'
    }
  }

  getPerson(id='') {
    return this.data.byId[id];
  }

  /**
   * Get
   */
  setPersonLoading(id, promise) {
    this._setPersonState({
      id,
      state: this.STATE.LOADING,
      request : promise
    });
  }

  setPersonLoaded(id, payload) {
    this._setPersonState({
      id,
      state: this.STATE.LOADED,
      payload
    });
  }

  setPersonError(id, error) {
    this._setPersonState({
      id,
      state: this.STATE.ERROR,
      error
    });
  }

  _setPersonState(state) {
    this.data.byId[state.id] = state;
    this.emit(this.events.PERSON_UPDATE, state);
  }

}

module.exports = new PersonStore();
