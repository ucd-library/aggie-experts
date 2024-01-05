var {BaseStore} = require('@ucd-lib/cork-app-utils');

class ExpertStore extends BaseStore {

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
      EXPERT_UPDATE : 'expert-update',
      EXPERT_SEARCH_UPDATE : 'expert-search-update'
    }
  }

  getExpert(id='', noSanitize=false) {
    if( noSanitize ) this.data.byId[id] = null;
    return this.data.byId[id];
  }

  /**
   * Get
   */
  setExpertLoading(id, promise) {
    this._setExpertState({
      id,
      state: this.STATE.LOADING,
      request : promise
    });
  }

  setExpertLoaded(id, payload) {
    this._setExpertState({
      id,
      state: this.STATE.LOADED,
      payload
    });
  }

  setExpertError(id, error) {
    this._setExpertState({
      id,
      state: this.STATE.ERROR,
      error
    });
  }

  _setExpertState(state) {
    this.data.byId[state.id] = state;
    this.emit(this.events.EXPERT_UPDATE, state);
  }

}

module.exports = new ExpertStore();
