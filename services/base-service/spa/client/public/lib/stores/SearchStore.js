var {BaseStore} = require('@ucd-lib/cork-app-utils');

class SearchStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      bySearchTerm : {},
      search : {
        state : this.STATE.INIT
      }
    }

    this.events = {
      SEARCH_UPDATE : 'search-update',
    }
  }

  search(searchTerm='', page=1, size=10, hasAvailability=[]) {
    let searchQuery = `q=${searchTerm}&page=${page}&size=${size}&hasAvailability=${encodeURIComponent(hasAvailability)}`;
    return this.data.bySearchTerm[searchQuery];
  }

  /**
   * Search
   */
  setSearchLoading(searchTerm, request) {
    this._setSearchState({
      state : this.STATE.LOADING,
      request, searchTerm
    })
  }

  setSearchLoaded(searchTerm, payload) {
    this._setSearchState({
      state : this.STATE.LOADED,
      searchTerm, payload
    })
  }

  setSearchError(searchTerm, error) {
    this._setSearchState({
      state : this.STATE.ERROR,
      searchTerm, error
    })
  }

  _setSearchState(state) {
    this.data.search = state;
    this.emit(this.events.SEARCH_UPDATE, this.data.search);
  }

}

module.exports = new SearchStore();
