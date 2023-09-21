var {BaseStore} = require('@ucd-lib/cork-app-utils');

class WorkStore extends BaseStore {

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
      WORK_UPDATE : 'work-update',
      WORK_SEARCH_UPDATE : 'work-search-update'
    }
  }

  getWork(id='') {
    return this.data.byId[id];
  }

  /**
   * Search
   */
  setSearchLoading(searchDocument, request) {
    this._setSearchState({
      state : this.STATE.LOADING,
      request, searchDocument
    })
  }

  setSearchLoaded(searchDocument, payload) {
    this._setSearchState({
      state : this.STATE.LOADED,
      searchDocument, payload
    })
  }

  setSearchError(searchDocument, error) {
    this._setSearchState({
      state : this.STATE.ERROR,
      searchDocument, error
    })
  }

  _setSearchState(state) {
    this.data.search = state;
    this.emit(this.events.WORK_SEARCH_UPDATE, this.data.search);
  }

  /**
   * Get
   */
  setWorkLoading(id, promise) {
    this._setWorkState({
      id,
      state: this.STATE.LOADING,
      request : promise
    });
  }

  setWorkLoaded(id, payload) {
    this._setWorkState({
      id,
      state: this.STATE.LOADED,
      payload
    });
  }

  setWorkError(id, error) {
    this._setWorkState({
      id,
      state: this.STATE.ERROR,
      error
    });
  }

  _setWorkState(state) {
    if( state.state === this.STATE.LOADED ) {
      // TODO any extra data translation?
    }
    this.data.byId[state.id] = state;
    this.emit(this.events.WORK_UPDATE, state);
  }

}

module.exports = new WorkStore();
