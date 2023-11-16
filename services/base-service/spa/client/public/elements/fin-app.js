import { LitElement } from 'lit';
import {render} from "./fin-app.tpl.js";

import md5 from 'md5';

// import '@ucd-lib/theme-elements/brand/ucd-theme-header/ucd-theme-header.js'
import '../elements/pages/home/app-home.js';
import '../elements/pages/browse/app-browse.js';
// import '../elements/pages/work/app-work.js';
import '../elements/pages/expert/app-expert.js';
import '../elements/pages/expert/app-expert-works-list.js';
import '../elements/pages/expert/app-expert-works-list-edit.js';
import '../elements/pages/expert/app-expert-grants-list.js';
import '../elements/pages/expert/app-expert-grants-list-edit.js';
import '../elements/pages/search/app-search.js';
import '../elements/pages/404/app-404.js';
import '../elements/pages/faq/app-faq.js';
import '../elements/pages/termsofuse/app-tou.js';

import '../elements/components/site/ucdlib-site-footer.js';
import '../elements/components/site/ucdlib-site-footer-column.js';

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
      pathInfo: { type: String },
      expertId: { type: String },
      expertNameImpersonating: { type: String },
      hideImpersonate: { type: Boolean },
    }
  }

  constructor() {
    super();
    this.appRoutes = APP_CONFIG.appRoutes;
    this._injectModel('AppStateModel', 'ExpertModel');

    this.page = 'home';
    this.imageSrc = '';
    this.imageAltText = '';
    this.pathInfo = '';
    this.expertId = '';
    this.expertNameImpersonating = '';
    this.hideImpersonate = true;

    this.render = render.bind(this);
    this._init404();
  }

  /**
   * @method _init404
   * @description event handler for 404 event
   */
  async _init404() {
    window.addEventListener('404', async () => {
      this.AppStateModel.show404Page();
    });
  }

  async firstUpdated() {
    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @param {Object} e
   */
   async _onAppStateUpdate(e) {
    if ( e.location.query && e.location.query.s !== undefined ) {
      this.isSearch = true;
      this.textQuery = e.location.query.s;
    }
    else {
      this.textQuery = "";
      this.isSearch = false;
    }
    window.scrollTo(0, 0);

    let expertHash = md5((APP_CONFIG.user?.preferred_username || '') + '@ucdavis.edu');
    if( expertHash ) {
      this.expertId = 'expert/' + expertHash;

      // this.expertId = 'expert/66356b7eec24c51f01e757af2b27ebb8'; // hack for testing as QH

      APP_CONFIG.user.expertId = this.expertId;

      // check if expert exists for currently logged in user, otherwise hide profile link in header quick links
      let header = this.shadowRoot.querySelector('ucd-theme-header');
      let quickLinks = header?.querySelector('ucd-theme-quick-links');

      try {
        await this.ExpertModel.get(this.expertId, true); // head request only
        if( quickLinks ) {
          quickLinks.shadowRoot.querySelector('ul.menu > li > a').href = '/' + this.expertId;
        }
      } catch (error) {
        console.warn('expert ' + this.expertId + ' not found for logged in user');

        if( quickLinks ) {
          quickLinks.shadowRoot.querySelector('ul.menu > li > a').style.display = 'none';
        }
      }

      let appExpert = this.shadowRoot.querySelector('app-expert');
      if( appExpert ) appExpert.toggleAdminUi();
    }

    let page = e.location.page;
    if( !APP_CONFIG.appRoutes.includes(e.location.page) ) page = '404';

    if( this.page === page ) return;
    this.page = page;
    this.pathInfo = e.location.pathname.split('/media')[0];

    this.firstAppStateUpdate = false;
  }

  /**
   * @method _onSearch
   * @description called from the search box button is clicked or
   * the enter key is hit. search
   * @param {Object} e
   */
  _onSearch(e) {
    if( e.detail?.searchTerm?.trim().length ) this.AppStateModel.setLocation('/search/'+e.detail.searchTerm.trim());
  }

  /**
   * @method _impersonateClick
   * @description impersonate expert
   *
   * @param {Object} e
   */
  _impersonateClick(e) {
    e.preventDefault();

    // show button showing who we're impersonating
    this.hideImpersonate = false;
    this.expertNameImpersonating = APP_CONFIG.impersonating?.expertName;
  }

  /**
   * @method _cancelImpersonateClick
   * @description cancel impersonating an expert
   *
   * @param {Object} e
   */
  _cancelImpersonateClick(e) {
    e.preventDefault();

    this.hideImpersonate = true;
    this.expertNameImpersonating = '';
    APP_CONFIG.impersonating = {};

    let appExpert = this.shadowRoot.querySelector('app-expert');
    if( appExpert ) appExpert.cancelImpersonate();
  }

}

customElements.define('fin-app', FinApp);
