const {AppStateModel} = require('@ucd-lib/cork-app-state');
const AppStateStore = require('../stores/AppStateStore');
const clone = require('clone');

class AppStateModelImpl extends AppStateModel {

  constructor() {
    super();
    this.store = AppStateStore;

    this.init(APP_CONFIG.appRoutes);
  }

  set(update) {
    if( update.location ) {
      update.lastLocation = clone(this.store.data.location);

      let page = update.location.path ? update.location.path[0] : 'home';
      if( !page ) page = 'home'

      update.location.page = page;
    }

    return super.set(update);
  }

  /**
   * @method show404Page
   * @description set the app state to the virtual 404 page
   */
  show404Page() {
    this.set({page: '404'});
  }

}

module.exports = new AppStateModelImpl();
