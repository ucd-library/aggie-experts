var {BaseStore, LruStore} = require('@ucd-lib/cork-app-utils');

class BrowseByStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      byExpertsAZ : new LruStore({name: 'browse.experts.az'}),
      byGrantsAZ : new LruStore({name: 'browse.grants.az'}),
      byWorksAZ : new LruStore({name: 'browse.works.az'}),
      byExpertsLastInitial : new LruStore({name: 'browse.experts'}),
      byGrantsLastInitial : new LruStore({name: 'browse.grants'}),
      byWorksLastInitial : new LruStore({name: 'browse.works'})
    }

    this.events = {};
  }

}

module.exports = new BrowseByStore();
