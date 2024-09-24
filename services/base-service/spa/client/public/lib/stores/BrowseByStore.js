var {BaseStore, LruStore} = require('@ucd-lib/cork-app-utils');

class BrowseByStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      byExpertsLastInitial : new LruStore({name: 'browse.experts'}),
      byExpertsAZ : new LruStore({name: 'browse.experts.az'})
    }

    this.events = {
      BROWSE_EXPERTS_UPDATE : 'browse-experts-update',
      BROWSE_EXPERTS_AZ_UPDATE : 'browse-experts-az-update'
    }
  }

}

module.exports = new BrowseByStore();
