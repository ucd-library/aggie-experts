var {BaseStore} = require('@ucd-lib/cork-app-utils');

class BrowseByStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      byLastInitial : {},
      experts : {
        state : this.STATE.INIT
      }
    }

    this.events = {
      BROWSE_EXPERTS_UPDATE : 'browse-experts-update',
    }
  }

  /**
   * Browse By Experts
   */
  browseExperts(lastInitial='') {
    return this.data.byLastInitial[lastInitial];
  }

  setBrowseExpertsLoading(lastInitial, request) {
    this._setBrowseExpertsState({
      state : this.STATE.LOADING,
      request, lastInitial
    })
  }

  setBrowseExpertsLoaded(lastInitial, payload) {
    this._setBrowseExpertsState({
      state : this.STATE.LOADED,
      lastInitial, payload
    })
  }

  setBrowseExpertsError(lastInitial, error) {
    this._setBrowseExpertsState({
      state : this.STATE.ERROR,
      lastInitial, error
    })
  }

  _setBrowseExpertsState(state) {
    this.data.experts = state;
    this.emit(this.events.BROWSE_EXPERTS_UPDATE, this.data.experts);
  }

}

module.exports = new BrowseByStore();
