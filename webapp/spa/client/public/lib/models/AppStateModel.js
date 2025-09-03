const {AppStateModel} = require('@ucd-lib/cork-app-state');
const AppStateStore = require('../stores/AppStateStore');
const clone = require('clone');

class AppStateModelImpl extends AppStateModel {

  constructor() {
    super();
    this.store = AppStateStore;

    if( !APP_CONFIG.enableGA4Stats ) console.warn('GA4 stats are disabled by flag');
    if( !window.gtag ) console.warn('No global gtag variable set for analytics events');
    if( !APP_CONFIG.gaId && APP_CONFIG.enableGA4Stats ) console.warn('GA4 stats are enabled but no GA ID is set');

    this.init(APP_CONFIG.appRoutes);
    this._sendGA();
  }

  set(update) {
    if( update.location ) {
      update.lastLocation = clone(this.store.data.location);

      let page = update.location.path ? update.location.path[0] : 'home';
      if( page === 'expert' && update.location.path.length > 2 ) page = update.location.path[2]; // works / works-edit / grants / grants-edit
      if( !page ) page = 'home';

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
    if( !APP_CONFIG.enableGA4Stats ) return;
    if( !window.gtag ) return;
    if( !APP_CONFIG.gaId ) return;

    if( this.lastGaLocation === window.location.pathname ) return;
    this.lastGaLocation = window.location.pathname;

    // temp hack until env variables are used
    gtag('config', (APP_CONFIG.gaId), {
      page_path: window.location.pathname
    });
  }


}

module.exports = new AppStateModelImpl();
