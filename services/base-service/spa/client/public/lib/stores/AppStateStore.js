const {AppStateStore} = require('@ucd-lib/cork-app-state');

class ImplAppStateStore extends AppStateStore {

  constructor() {
    super();
  }

  set(state) {
    super.set(state);
  }

}

module.exports = new ImplAppStateStore();
