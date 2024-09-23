var {BaseStore, LruStore} = require('@ucd-lib/cork-app-utils');
const payloadUtils = require('../payload.js').default;


class SearchStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      bySearchQuery : new LruStore({name: 'search.bySearchQuery'})
    }

    this.events = {
      SEARCH_UPDATE : 'search-update'
    }
  }

  onSearchUpdate(ido, payload) {
    this._set(
      payloadUtils.generate(ido, payload),
      this.data.bySearchQuery,
      this.events.SEARCH_UPDATE
    );
  }

  _set(payload, store, event) {
    store.set(payload.id, payload);
    this.emit(event, payload);
  }

}

module.exports = new SearchStore();
