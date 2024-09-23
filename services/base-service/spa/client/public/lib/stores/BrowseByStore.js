var {BaseStore, LruStore} = require('@ucd-lib/cork-app-utils');
const payloadUtils = require('../payload.js').default;

class BrowseByStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      byExpertsLastInitial : new LruStore({name: 'browse.byExpertsLastInitial'}),
      byExpertsAZ : new LruStore({name: 'browse.byExpertsAZ'})
    }

    this.events = {
      BROWSE_EXPERTS_UPDATE : 'browse-experts-update',
      BROWSE_EXPERTS_AZ_UPDATE : 'browse-experts-az-update'
    }
  }

  onBrowseExpertsAZUpdate(ido, payload) {
    this._set(
      payloadUtils.generate(ido, payload),
      this.data.byExpertsAZ,
      this.events.BROWSE_EXPERTS_AZ_UPDATE
    );
  }

  onBrowseExpertsUpdate(ido, payload) {
    this._set(
      payloadUtils.generate(ido, payload),
      this.data.byExpertsLastInitial,
      this.events.BROWSE_EXPERTS_UPDATE
    );
  }

  _set(payload, store, event) {
    store.set(payload.id, payload);
    this.emit(event, payload);
  }

}

module.exports = new BrowseByStore();
