import { LitElement } from 'lit';
import {render} from "./fin-app.tpl.js";

// import '@ucd-lib/theme-elements/brand/ucd-theme-header/ucd-theme-header.js'
import '../elements/pages/app-home.js';
import '../elements/pages/app-work.js';

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

import '@ucd-lib/theme-elements/brand/ucd-theme-header/ucd-theme-header.js';
import '@ucd-lib/theme-elements/brand/ucd-theme-primary-nav/ucd-theme-primary-nav.js';
import '@ucd-lib/theme-elements/brand/ucd-theme-search-popup/ucd-theme-search-popup.js';
import '@ucd-lib/theme-elements/brand/ucd-theme-search-form/ucd-theme-search-form.js';
import '@ucd-lib/theme-elements/brand/ucd-theme-quick-links/ucd-theme-quick-links.js';
import '@ucd-lib/theme-elements/ucdlib/ucdlib-pages/ucdlib-pages.js';

export default class FinApp extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      page: { type: String },
      imageSrc: { type: String },
      imageAltText: { type: String },
    }
  }

  constructor() {
    super();
    this.appRoutes = APP_CONFIG.appRoutes;
    this._injectModel('AppStateModel');

    this.render = render.bind(this);
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @param {Object} e
   */
   async _onAppStateUpdate(e) {
    debugger;
    if ( e.location.query && e.location.query.s !== undefined ) {
      this.isSearch = true;
      this.textQuery = e.location.query.s;
    }
    else {
      this.textQuery = "";
      this.isSearch = false;
    }

    let page = e.location.page;
    if( this.page === page ) return;
    this.page = page;

    window.scrollTo(0, 0);
    this.firstAppStateUpdate = false;
  }

}

customElements.define('fin-app', FinApp);
