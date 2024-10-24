var {BaseStore, LruStore} = require('@ucd-lib/cork-app-utils');

class BrowseByStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      byExpertsAZ : new LruStore({name: 'browse.experts.az'}),
      byGrantsAZ : new LruStore({name: 'browse.grants.az'}),
      byExpertsLastInitial : new LruStore({name: 'browse.experts'}),
      byGrantsLastInitial : new LruStore({name: 'browse.grants'}),
    }

    this.events = {};
  }

}

module.exports = new BrowseByStore();
