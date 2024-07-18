import { LitElement } from 'lit';
import {render} from "./fin-app.tpl.js";

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
      page : { type : String },
      loadedPages : { type : Object },
      imageSrc : { type : String },
      imageAltText : { type : String },
      pathInfo : { type : String },
      expertId : { type : String },
      expertNameEditing : { type : String },
      hideEdit : { type : Boolean },
      loading : { type : Boolean },
    }
  }

  constructor() {
    super();
    this.appRoutes = APP_CONFIG.appRoutes;
    this._injectModel('AppStateModel', 'ExpertModel');

    // hack to customize header quick links, need to update styles if screen goes into mobile mode vs desktop mode and vice-versa
    window.addEventListener("resize", this._validateLoggedInUser.bind(this));

    this.page = 'loading';
    this.loadedPages = {};
    this.imageSrc = '';
    this.imageAltText = '';
    this.pathInfo = '';
    this.expertId = utils.getCookie('editingExpertId');
    this.expertNameEditing = utils.getCookie('editingExpertName');
    this.hideEdit = !utils.getCookie('editingExpertId');
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

    let quickLinks = header?.querySelector('ucd-theme-quick-links');
    if( quickLinks?.opened ) quickLinks.close();

    let searchPopup = header?.querySelector('ucd-theme-search-popup');
    if( searchPopup?.opened ) searchPopup.close();
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

    if ( !this.loadedPages[page] ) {
      this.page = 'loading';
      this.loadedPages[page] = this.loadPage(page);
    }
    await this.loadedPages[page];
    this.page = page;

    // this.page = page;
    this.pathInfo = e.location.pathname.split('/media')[0];

    this.firstAppStateUpdate = false;

    this._closeHeader();
  }

  /**
   * @method loadPage
   * @description code splitting done here. dynamic import a page based on route
   *
   * @param {String} page page to load
   *
   * @returns {Promise}
   */
  loadPage(page) {
    if( page === 'home' ) {
      return import(/* webpackChunkName: "page-home" */ "./pages/home/app-home");
    } else if( page === 'browse' ) {
      return import(/* webpackChunkName: "page-browse" */ "./pages/browse/app-browse");
    } else if( page === 'faq' ) {
      return import(/* webpackChunkName: "page-faq" */ "./pages/faq/app-faq");
    } else if( page === '404' ) {
      return import(/* webpackChunkName: "page-404" */ "./pages/404/app-404");
    } else if( page === 'search' ) {
      return import(/* webpackChunkName: "page-search" */ "./pages/search/app-search");
    } else if( page === 'termsofuse' ) {
      return import(/* webpackChunkName: "page-tou" */ "./pages/termsofuse/app-tou");
    } else if( page === 'expert' ) {
      return import(/* webpackChunkName: "page-expert" */ "./pages/expert/app-expert");
    } else if( page === 'works' ) {
      return import(/* webpackChunkName: "page-works" */ "./pages/expert/app-expert-works-list");
    } else if( page === 'works-edit' ) {
      return import(/* webpackChunkName: "page-works-edit" */ "./pages/expert/app-expert-works-list-edit");
    } else if( page === 'grants' ) {
      return import(/* webpackChunkName: "page-grants" */ "./pages/expert/app-expert-grants-list");
    } else if( page === 'grants-edit' ) {
      return import(/* webpackChunkName: "page-grants-edit" */ "./pages/expert/app-expert-grants-list-edit");
    }
    console.warn('No code chunk loaded for this page');
    return false;
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

    if( this.page === 'expert' ) {
      let appExpert = this.shadowRoot.querySelector('app-expert');
      if( appExpert ) appExpert.toggleAdminUi();
    }

    this._styleEditExpertButton();
  }

  /**
   * @method _styleEditExpertButton
   * @description style edit button based on screen width to ensure edit button doesn't overlap header
   */
  _styleEditExpertButton() {
    requestAnimationFrame(() => {
      let editExpertBtn = this.shadowRoot.querySelector('.edit-expert-btn');
      let editExpertContainer = this.shadowRoot.querySelector('.edit-expert-container');
      let headerLogoContainer = this.shadowRoot.querySelector('ucd-theme-header')?.shadowRoot.querySelector('.site-branding');
      let mainContent = this.shadowRoot.querySelector('.main-content');
      let minSpace = parseFloat(getComputedStyle(document.documentElement).fontSize);
      let headerLogoMin = 300; // hack sometimes this runs before the header component renders the logo, this works well as fallback

      if( !editExpertBtn || !headerLogoContainer ) return;

      const editExpertContainerDisplay = this.hideEdit ? 'none' : 'flex' ;
      editExpertContainer.style.display = editExpertContainerDisplay;

      if (editExpertContainerDisplay === 'none') editExpertContainer.style.display = 'flex';

      let editExpertBtnRect = editExpertBtn.getBoundingClientRect();
      let headerLogoContainerRect = headerLogoContainer.getBoundingClientRect();

      if (editExpertContainerDisplay === 'none') editExpertContainer.style.display = editExpertContainerDisplay;

      let collapse = !((headerLogoContainerRect.right < editExpertBtnRect.left - minSpace &&
        headerLogoMin < editExpertBtnRect.left - minSpace) ||
        headerLogoContainerRect.left > editExpertBtnRect.right + minSpace ||
        headerLogoContainerRect.bottom < editExpertBtnRect.top - minSpace ||
        headerLogoContainerRect.top > editExpertBtnRect.bottom + minSpace);

      if( collapse && !this.hideEdit ) {
        mainContent.classList.add('collapse');
        mainContent.classList.add('editing');
        editExpertContainer.classList.add('collapse');
      } else {
        mainContent.classList.remove('collapse');
        mainContent.classList.remove('editing');
        editExpertContainer.classList.remove('collapse');
      }
    });
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
   * @method _editExpertClick
   * @description edit expert
   *
   * @param {Object} e
   */
  _editExpertClick(e) {
    e.preventDefault();

    if( !(APP_CONFIG.user?.roles || []).includes('admin') ) return;

    // show button showing who we're editing
    this.hideEdit = false;

    document.cookie = 'editingExpertId='+e.detail.expertId+'; path=/';
    document.cookie = 'editingExpertName='+e.detail.expertName+'; path=/';

    this.expertNameEditing = e.detail.expertName;
    this._styleEditExpertButton();
  }

  /**
   * @method _cancelEditExpertClick
   * @description cancel editing an expert
   *
   * @param {Object} e
   */
  _cancelEditExpertClick(e) {
    e.preventDefault();

    this.hideEdit = true;

    document.cookie = "editingExpertId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
    document.cookie = "editingExpertName=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";

    this.expertNameEditing = '';

    let appExpert = this.shadowRoot.querySelector('app-expert');
    if( appExpert ) appExpert.cancelEditExpert();
    this._styleEditExpertButton();
  }

}

customElements.define('fin-app', FinApp);
