var {BaseStore, LruStore} = require('@ucd-lib/cork-app-utils');

class DagsterStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      byId : new LruStore({name: 'dagster'})
    }

    this.events = {
      DAGSTER_UPDATE : 'dagster-update'
    }
  }

}

module.exports = new DagsterStore();
