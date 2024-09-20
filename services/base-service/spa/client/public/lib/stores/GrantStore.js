var {BaseStore} = require('@ucd-lib/cork-app-utils');

class GrantStore extends BaseStore {

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
      WORK_UPDATE : 'grant-update',
      WORK_SEARCH_UPDATE : 'grant-search-update'
    }
  }

  getGrant(id='') {
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
  setGrantLoading(id, promise) {
    this._setGrantState({
      id,
      state: this.STATE.LOADING,
      request : promise
    });
  }

  setGrantLoaded(id, payload) {
    this._setGrantState({
      id,
      state: this.STATE.LOADED,
      payload
    });
  }

  setGrantError(id, error) {
    this._setGrantState({
      id,
      state: this.STATE.ERROR,
      error
    });
  }

  _setGrantState(state) {
    if( state.state === this.STATE.LOADED ) {
      // TODO any extra data translation?
    }
    this.data.byId[state.id] = state;
    this.emit(this.events.WORK_UPDATE, state);
  }

}

module.exports = new GrantStore();
