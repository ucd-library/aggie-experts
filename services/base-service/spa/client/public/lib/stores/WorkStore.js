var {BaseStore, LruStore} = require('@ucd-lib/cork-app-utils');

class WorkStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      byId : new LruStore({name: 'work'})
    }

    this.events = {
      WORK_UPDATE : 'work-update'
    }
  }

}

module.exports = new WorkStore();
