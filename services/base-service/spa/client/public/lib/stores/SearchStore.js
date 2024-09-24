var {BaseStore, LruStore} = require('@ucd-lib/cork-app-utils');

class SearchStore extends BaseStore {

  constructor() {
    super();

    this.data = {
      bySearchQuery : new LruStore({name: 'search'})
    }

    this.events = {
      SEARCH_UPDATE : 'search-update'
    }
  }

}

module.exports = new SearchStore();
