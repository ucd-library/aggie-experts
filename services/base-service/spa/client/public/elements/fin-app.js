import { LitElement, html } from 'lit';
import render from "./fin-app.tpl.js";

import "@ucd-lib/fin-icons";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

// styles
import "./styles/shared-styles";

// main library
import '../lib';

// app elements
import "./pages/search/app-search-header";
import "./pages/search/app-search-breadcrumb";
import "./app-footer";
import "./auth/app-auth-footer";
import "./components/site/ucdlib-site-footer";
import "./components/site/ucdlib-site-footer-column";
import "./utils/app-header-colorbar";

export class FinApp extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      page : {type: String},
      appRoutes : {type: Array},
      showSearchHeader : {type: Boolean},
      showBreadcrumb : {type : Boolean},
      drawerOpen : {type : Boolean},
      localBuildTime : {type: String},
      appVersion : {type: String},
      clientTag : {type: String},
      clientHash : {type: String},
      coreTag : {type: String},
      coreHash : {type: String},
      showVersion : {type: Boolean}
    };
  }

  constructor() {
    super();
    this.active = true;
    this.render = render.bind(this);
    this.SEARCH_HEADER_PAGES = ['about', 'item', 'search', 'collections', 'collection', 'components', 'browse'];
    this.BREADCRUMB_PAGES = ['item', 'search', 'collections'];

    this.loadedPages = {};

    this.page = 'loading';
    this.appRoutes = APP_CONFIG.appRoutes;
    this.showSearchHeader = false;
    this.showBreadcrumb = false;
    this.drawerOpen = false;

    // App Version variables
    this.showVersion = APP_CONFIG.env.UCD_DAMS_DEPLOYMENT_BRANCH !== 'main';

    this.appVersion = APP_CONFIG.env.APP_VERSION;
    this.buildNum = APP_CONFIG.env.BUILD_NUM;
    this.clientEnv = APP_CONFIG.env.CLIENT_ENV;
    this.finAppVersion = APP_CONFIG.env.FIN_APP_VERSION;
    this.finBranchName = APP_CONFIG.env.FIN_BRANCH_NAME;
    this.finRepoTag = APP_CONFIG.env.FIN_REPO_TAG;
    this.finServerImage = APP_CONFIG.env.FIN_SERVER_IMAGE;
    this.finServerRepoHash = APP_CONFIG.env.FIN_SERVER_REPO_HASH;
    this.damsDeployBranch = APP_CONFIG.env.UCD_DAMS_DEPLOYMENT_BRANCH;
    this.damsDeploySha = APP_CONFIG.env.UCD_DAMS_DEPLOYMENT_SHA;
    this.damsDeployTag = APP_CONFIG.env.UCD_DAMS_DEPLOYMENT_TAG;
    this.damsRepoBranch = APP_CONFIG.env.UCD_DAMS_REPO_BRANCH;
    this.damsRepoSha = APP_CONFIG.env.UCD_DAMS_REPO_SHA;
    this.damsRepoTag = APP_CONFIG.env.UCD_DAMS_REPO_TAG;

    if( APP_CONFIG.env.BUILD_TIME ) {
      this.localBuildTime = new Date(APP_CONFIG.env.BUILD_TIME).toISOString().replace('T', ' ');
    } else {
      this.localBuildTime = 'Not set';
    }

    this._injectModel('AppStateModel', 'AuthModel', 'CollectionModel', 'RecordModel');
  }

  ready() {
    let loadingEle = document.querySelector('#loading');
    if( loadingEle ) document.body.removeChild(loadingEle);

    super.ready();

    // set initial user state
    this.AuthModel.store.setUser(APP_CONFIG.user);
  }

  /**
   * @method _onAppStateUpdate
   * @description AppStateInterface
   */
  async _onAppStateUpdate(e) {
    this.drawerOpen = e.filtersDrawerOpen ? true : false;

    if( e.location.page === this.page ) return;

    this.showBreadcrumb = this.BREADCRUMB_PAGES.includes(e.location.page);
    this.showSearchHeader = this.SEARCH_HEADER_PAGES.includes(e.location.page);

    this.appState = e;
    window.scrollTo(0, 0);
    let page = e.location.page;
    if( !this.loadedPages[page] ) {
      this.page = 'loading';
      this.loadedPages[page] = this.loadPage(page);
    }
    await this.loadedPages[page];

    // handle browse by pages
    if( page === 'browse' && e.location.path.length > 1 ) {
      page = e.location.path[1];
    }


    this.page = page;
  }

  /**
   * @method loadPage
   * @description code splitting done here.  dynamic import a page based on route
   *
   * @param {String} page page to load
   * @returns {String} import()
   */
  loadPage(page) {
//    if( page === 'home' ) {
//      return import(/* webpackChunkName: "page-home" */ "./pages/home/app-home");
    //    } else
    if( page === 'about' ) {
      return import(/* webpackChunkName: "page-about" */ "./pages/about/app-about");
    }
    return page;
  }

  /**
   * @method _toggleDrawer
   * @description toggles the drawer state.  Listens to
   * toggle-drawer event from app-search-results-panel
   */
  _toggleDrawer() {
    this.AppStateModel.set({filtersDrawerOpen: !this.drawerOpen});
  }


  /**
   * @method _onRecordSearchUpdate
   * @description RecordInterface, fired when search document updates.
   * used to set the window url
   *
   */
  // _onRecordSearchUpdate(e) {
  //   if( this.appState.location.path[0] === 'collection' ) return;

  //   let path = this._searchDocumentToUrl(e.searchDocument, true);
  //   if( path.match(/\/collection/) ) {
  //     this._setWindowLocation(path);
  //   } else {
  //     this._setWindowLocation('/search/'+path);
  //   }

  // }
}

customElements.define('fin-app', FinApp);