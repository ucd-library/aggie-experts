import { LitElement } from 'lit';
import {render} from "./app-browse-by.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";
import '../../components/ucdlib-browse-az.js';
import '../../components/search-result-row.js';

export default class AppBrowseBy extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      browseType : { type : String, attribute : 'browse-type' },
      letter : { type : String },
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

    this.browseType = '';
    this.letter = '';
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

    this.browseType = e.location.path[1];
    this.letter = e.location.path[2];

    this.displayedResults = [];

    let page = e.location.path[3];
    let resultsPerPage = e.location.path[4];

    if( this.letter ) {
      this.currentPage = parseInt(page) ? page : 1;
      this.resultsPerPage = parseInt(resultsPerPage) ? resultsPerPage : 25;

      if( this.browseType === 'expert' ) {
        this._onBrowseExpertsUpdate(await this.BrowseByModel.browseBy('expert', this.letter, this.currentPage, this.resultsPerPage));
      } else if( this.browseType === 'grant' ) {
        this._onBrowseGrantsUpdate(await this.BrowseByModel.browseBy('grant', this.letter, this.currentPage, this.resultsPerPage));
      }
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
   * @method _onBrowseGrantsUpdate
   * @description bound to BrowseByModel browse-grants-update event
   *
   * @param {Object} e
   * @returns {Promise}
   */
  _onBrowseGrantsUpdate(e) {
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
      let subtitle = ((r.name?.split('§') || [])[1] || '').trim().replaceAll('•', '<span class="dot-separator">•</span>');

      return {
        position: index+1,
        id: 'grant/'+id,
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

    let path = `/browse/${this.browseType}/${this.letter}`;
    if( this.currentPage > 1 || this.resultsPerPage > 25 ) path += `/${this.currentPage}`;
    if( this.resultsPerPage > 25 ) path += `/${this.resultsPerPage}`;

    this.AppStateModel.setLocation(path);

    window.scrollTo(0, 0);
  }

}

customElements.define('app-browse-by', AppBrowseBy);
