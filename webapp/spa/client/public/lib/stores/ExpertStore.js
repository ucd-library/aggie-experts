var {BaseStore, LruStore} = require('@ucd-lib/cork-app-utils');

class ExpertStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      byId : new LruStore({name: 'expert'})
    }

    this.events = {
      EXPERT_UPDATE : 'expert-update'
    }
  }

}

module.exports = new ExpertStore();
