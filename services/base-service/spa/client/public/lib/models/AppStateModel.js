const {AppStateModel} = require('@ucd-lib/cork-app-state');
const AppStateStore = require('../stores/AppStateStore');
const clone = require('clone');

class AppStateModelImpl extends AppStateModel {

  constructor() {
    super();
    this.store = AppStateStore;

    this.init(APP_CONFIG.appRoutes);
    this._sendGA();
  }

  set(update) {
    if( update.location ) {
      update.lastLocation = clone(this.store.data.location);

      let page = update.location.path ? update.location.path[0] : 'home';
      if( !page ) page = 'home'

      update.location.page = page;
    }
    this._sendGA();
    return super.set(update);
  }

  /**
   * @method show404Page
   * @description set the app state to the virtual 404 page
   */
  show404Page() {
    this.set({page: '404'});
  }

    /**
   * @method _sendGA
   * @description send a google analytics event if pathname has changed
   */
  _sendGA() {
    if( !window.gtag ) return console.warn('No global gtag variable set for analytics events');
    if( this.lastGaLocation === window.location.pathname ) return;
    this.lastGaLocation = window.location.pathname;

    gtag('config', config.gaCode, {
      page_path: window.location.pathname
    });
  }


}

module.exports = new AppStateModelImpl();
