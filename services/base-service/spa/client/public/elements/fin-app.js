import { LitElement } from 'lit';
import {render} from "./fin-app.tpl.js";

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

import utils from '../lib/utils';

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
      loading: { type: Boolean },
    }
  }

  constructor() {
    super();
    this.appRoutes = APP_CONFIG.appRoutes;
    this._injectModel('AppStateModel', 'ExpertModel');

    // hack to customize header quick links, need to update styles if screen goes into mobile mode vs desktop mode and vice-versa
    window.addEventListener("resize", this._validateLoggedInUser.bind(this));

    this.page = 'home';
    this.imageSrc = '';
    this.imageAltText = '';
    this.pathInfo = '';
    this.expertId = utils.getCookie('impersonateId');
    this.expertNameImpersonating = utils.getCookie('impersonateName');
    this.hideImpersonate = !utils.getCookie('impersonateId');
    this.loading = false;

    this.render = render.bind(this);
    this._init404();

    this.addEventListener('click', this.pageClick.bind(this));
  }

  pageClick(e) {
    // hack, make sure header popups are collapsed
    let header = this.shadowRoot.querySelector('ucd-theme-header');
    if( header ) {
      let searchPopup = header.querySelector('ucd-theme-search-popup');
      let quickLinks = header.querySelector('ucd-theme-quick-links');

      let searchClicked = e.composedPath().some(el => el.tagName === 'UCD-THEME-SEARCH-POPUP');
      let quickLinksClicked = e.composedPath().some(el => el.tagName === 'UCD-THEME-QUICK-LINKS');

      if( !searchClicked && searchPopup?.opened ) searchPopup.close();
      if( !quickLinksClicked && quickLinks?.opened ) quickLinks.close();
    }
  }

  _closeHeader() {
    // hack, make sure header popups are collapsed
    let header = this.shadowRoot.querySelector('ucd-theme-header');
    if( header && header.opened ) header.close();
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

    this._validateLoggedInUser();

    let page = e.location.page;
    let route = e.location.path[0] === 'expert' ? 'expert' : (e.location.page || 'home');
    if( !APP_CONFIG.appRoutes.includes(route) ) page = '404';

    if( this.page === page ) return;
    this.page = page;
    this.pathInfo = e.location.pathname.split('/media')[0];

    this.firstAppStateUpdate = false;

    this._closeHeader();
  }

  /**
   * @method _validateLoggedInUser
   * @description validate logged in user, hide profile link if expert not fount
   * for logged in user
   */
  async _validateLoggedInUser() {
    this.expertId = APP_CONFIG.user?.expertId || '';

    // check if expert exists for currently logged in user, otherwise hide profile link in header quick links
    let header = this.shadowRoot.querySelector('ucd-theme-header');
    let quickLinks = header?.querySelector('ucd-theme-quick-links');

    if( APP_CONFIG.user?.hasProfile ) {
      if( quickLinks ) {
        quickLinks.shadowRoot.querySelector('ul.menu > li > a').href = '/' + this.expertId;
      }
    } else {
      console.warn('expert ' + this.expertId + ' not found for logged in user');

      if( quickLinks ) {
        quickLinks.shadowRoot.querySelector('ul.menu > li > a').style.display = 'none';
        quickLinks.shadowRoot.querySelector('.quick-links--highlight ul.menu > li:nth-child(2)').style.top = '0';
        quickLinks.shadowRoot.querySelector('.quick-links--highlight ul.menu > li:nth-child(3)').style.top = '3.2175rem';
        quickLinks.shadowRoot.querySelector('.quick-links--highlight ul.menu > li:nth-child(4)').style.paddingTop = '0';

        if( window.innerWidth > 991 ) {
          quickLinks.shadowRoot.querySelector('.quick-links--highlight ul.menu').style.paddingTop = '6.5325rem';
          quickLinks.shadowRoot.querySelector('.quick-links--highlight ul.menu > li:nth-child(4)').style.paddingTop = '1rem';
        } else  {
          quickLinks.shadowRoot.querySelector('.quick-links--highlight ul.menu').style.paddingTop = '0';
        }
      }
    }

    let appExpert = this.shadowRoot.querySelector('app-expert');
    if( appExpert ) appExpert.toggleAdminUi();

    this._styleImpersonateButton();
  }

  /**
   * @method _styleImpersonateButton
   * @description style impersonate button based on screen width to ensure impersonate button doesn't overlap header
   */
  _styleImpersonateButton() {
    let impersonateBtn = this.shadowRoot.querySelector('.impersonate-btn');
    let impersonateContainer = this.shadowRoot.querySelector('.impersonate-container');
    let headerLogoContainer = this.shadowRoot.querySelector('ucd-theme-header')?.shadowRoot.querySelector('.site-branding');
    let mainContent = this.shadowRoot.querySelector('.main-content');
    let minSpace = parseFloat(getComputedStyle(document.documentElement).fontSize);

    if( !impersonateBtn || !headerLogoContainer ) return;

    const impersonateContainerDisplay = this.hideImpersonate ? 'none' : 'flex' ;
    impersonateContainer.style.display = impersonateContainerDisplay;

    if (impersonateContainerDisplay === 'none') impersonateContainer.style.display = 'flex';

    let impersonateBtnRect = impersonateBtn.getBoundingClientRect();
    let headerLogoContainerRect = headerLogoContainer.getBoundingClientRect();

    if (impersonateContainerDisplay === 'none') impersonateContainer.style.display = impersonateContainerDisplay;

    let collapse = !(headerLogoContainerRect.right < impersonateBtnRect.left - minSpace ||
      headerLogoContainerRect.left > impersonateBtnRect.right + minSpace ||
      headerLogoContainerRect.bottom < impersonateBtnRect.top - minSpace ||
      headerLogoContainerRect.top > impersonateBtnRect.bottom + minSpace);

    if( collapse && !this.hideImpersonate ) {
      mainContent.classList.add('collapse');
      mainContent.classList.add('impersonating');
      impersonateContainer.classList.add('collapse');
    } else {
      mainContent.classList.remove('collapse');
      mainContent.classList.remove('impersonating');
      impersonateContainer.classList.remove('collapse');
    }
  }

  /**
   * @method _onSearch
   * @description called from the search box button is clicked or
   * the enter key is hit. search
   * @param {Object} e
   */
  _onSearch(e) {
    if( e.detail?.searchTerm?.trim().length ) this.AppStateModel.setLocation('/search/'+e.detail.searchTerm.trim());
    this._closeHeader();
  }

  /**
   * @method _impersonateClick
   * @description impersonate expert
   *
   * @param {Object} e
   */
  _impersonateClick(e) {
    e.preventDefault();

    if( !(APP_CONFIG.user?.roles || []).includes('admin') ) return;

    // show button showing who we're impersonating
    this.hideImpersonate = false;

    document.cookie = 'impersonateId='+e.detail.expertId+'; path=/';
    document.cookie = 'impersonateName='+e.detail.expertName+'; path=/';

    this.expertNameImpersonating = e.detail.expertName;
    this._styleImpersonateButton();
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

    document.cookie = "impersonateId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
    document.cookie = "impersonateName=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";

    this.expertNameImpersonating = '';

    let appExpert = this.shadowRoot.querySelector('app-expert');
    if( appExpert ) appExpert.cancelImpersonate();
    this._styleImpersonateButton();
  }

}

customElements.define('fin-app', FinApp);
