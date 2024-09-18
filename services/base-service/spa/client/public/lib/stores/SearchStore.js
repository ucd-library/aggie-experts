var {BaseStore} = require('@ucd-lib/cork-app-utils');

class SearchStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      bySearchQuery : {},
      search : {
        state : this.STATE.INIT
      }
    }

    this.events = {
      SEARCH_UPDATE : 'search-update',
    }
  }

  search(searchQuery='') {
    return this.data.bySearchQuery[searchQuery];
  }

  /**
   * Search
   */
  setSearchLoading(searchQuery, request) {
    this._setSearchState({
      state : this.STATE.LOADING,
      request, searchQuery
    })
  }

  setSearchLoaded(searchQuery, payload) {
    this._setSearchState({
      state : this.STATE.LOADED,
      searchQuery, payload
    })
  }

  setSearchError(searchQuery, error) {
    this._setSearchState({
      state : this.STATE.ERROR,
      searchQuery, error
    })
  }

  _setSearchState(state) {
    this.data.bySearchQuery[state.searchQuery] = state;
    this.emit(this.events.SEARCH_UPDATE, state);
  }

}

module.exports = new SearchStore();
