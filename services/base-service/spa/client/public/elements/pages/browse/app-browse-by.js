import { LitElement } from 'lit';
import {render} from "./app-browse-by.tpl.js";

import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";
import '../../components/ucdlib-browse-az.js';
import '../../components/search-result-row.js';

export default class AppBrowseBy extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      id : { type : String },
      displayedResults : { type : Array },
      resultsPerPage  : { type : Number },
      currentPage : { type : Number },
      totalResultsCount : { type : Number },
      paginationTotal : { type : Number }
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);

    this.id = '';
    this.displayedResults = [];
    this.resultsPerPage = 25;
    this.currentPage = 1;
    this.totalResultsCount = 0;
    this.paginationTotal = 0;

    this._injectModel('AppStateModel', 'BrowseByModel');
  }

  async firstUpdated() {
    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  willUpdate() {
    // hack, pagination links too wide
    let pagination = this.shadowRoot.querySelector('ucd-theme-pagination');
    if( !pagination ) return;

    let pageLinks = pagination.shadowRoot.querySelectorAll('.pager__item a') || [];
    pageLinks.forEach(link => {
      link.style.padding = '0.25rem';
    });
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @param {Object} e
   * @returns {Promise}
   */
  async _onAppStateUpdate(e) {
    if( e.location.page !== 'browse' ) return;
    if( e.location.path.length < 3 ) {
      this.AppStateModel.setLocation('/browse/expert/a');
      return;
    }

    this.id = e.location.path[2];
    if( this.id ) {
      this.currentPage = 1;
      this.BrowseByModel.browseExperts(this.id, this.currentPage, this.resultsPerPage);
    }
  }

  /**
   * @method _onBrowseExpertsUpdate
   * @description bound to BrowseByModel browse-experts-update event
   *
   * @param {Object} e
   * @returns {Promise}
   */
  _onBrowseExpertsUpdate(e) {
    if( e.state !== 'loaded' ) return;
    if( !e.payload?.hits?.length ) {
      this.displayedResults = [];
      return;
    }

    // parse hits
    this.displayedResults = (e.payload?.hits || []).map((r, index) => {
      let id = r['@id'];
      if( Array.isArray(r.name) ) r.name = r.name[0];
      let name = r.name?.split('§')?.shift()?.trim();
      let subtitle = r.name?.split('§')?.pop()?.trim();
      if( name === subtitle ) subtitle = '';

      return {
        position: index+1,
        id,
        name,
        subtitle
      }
    });

    this.totalResultsCount = e.payload.total;
    this.paginationTotal = Math.ceil(this.totalResultsCount / this.resultsPerPage);
  }

  /**
   * @method _onPaginationChange
   * @description bound to click events of the pagination element
   *
   * @param {Object} e click|keyup event
   */
  _onPaginationChange(e) {
    this.currentPage = e.detail.page;
    this.BrowseByModel.browseExperts(this.id, this.currentPage, this.resultsPerPage);
    window.scrollTo(0, 0);
  }

}

customElements.define('app-browse-by', AppBrowseBy);
