var {BaseStore, LruStore} = require('@ucd-lib/cork-app-utils');
const payloadUtils = require('../payload.js').default;

class ExpertStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      byId : new LruStore({name: 'expert.byId'})
    }

    this.events = {
      EXPERT_UPDATE : 'expert-update'
    }
  }

  onExpertUpdate(ido, payload) {
    this._set(
      payloadUtils.generate(ido, payload),
      this.data.byId,
      this.events.EXPERT_UPDATE
    );
  }

  _set(payload, store, event) {
    store.set(payload.id, payload);
    this.emit(event, payload);
  }

}

module.exports = new ExpertStore();
