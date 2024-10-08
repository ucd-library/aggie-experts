var {BaseStore, LruStore} = require('@ucd-lib/cork-app-utils');

class GrantStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      byId : new LruStore({name: 'grant'})
    }

    this.events = {
      GRANT_UPDATE : 'grant-update'
    }
  }

}

module.exports = new GrantStore();
