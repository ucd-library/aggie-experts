import { LitElement } from 'lit';
import {render} from "./app-search.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";
import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";

import "../../components/search-box";
import "../../components/search-result-row";

export default class AppSearch extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      searchTerm : { type : String },
      searchResults : { type : Array },
      displayedResults : { type : Array },
      paginationTotal : { type : Number },
      currentPage : { type : Number },
      totalResultsCount : { type : Number },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'SearchModel');

    this.searchTerm = '';
    this.searchResults = [];
    this.displayedResults = [];
    this.paginationTotal = 1;
    this.currentPage = 1;
    this.resultsPerPage = 20;
    this.totalResultsCount = 0;

    this.render = render.bind(this);
  }

  firstUpdated() {
    if( this.AppStateModel.location.page !== 'search' ) return;

    // update search term
    this.searchTerm = this.AppStateModel.location.fullpath.replace('/search/', '');

    this._onSearch({ detail: this.searchTerm });
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
   * @return {Object} e
   */
  _onAppStateUpdate(e) {
    if( e.location.page !== 'search' ) return;

    let searchTerm = e.location.fullpath.replace('/search/', '');
    if( searchTerm === this.searchTerm ) return;

    this.searchTerm = searchTerm;
    this._onSearch({ detail: this.searchTerm });
  }

  /**
   * @method _onSearch
   * @description called from the search box button is clicked or
   * the enter key is hit. search
   * @param {Object} e
   */
  async _onSearch(e) {
    if( !e.detail?.trim().length ) return;

    // update url
    this.searchTerm = e.detail.trim();

    this.AppStateModel.setLocation(`/search/${this.searchTerm}`);

    this.currentPage = 1;

    // /api/search?q=evapotranspiration&page=2&size=2
    await this.SearchModel.search(this.searchTerm, this.currentPage, this.resultsPerPage);
    // handle in _onSearchUpdate(e)

    // this.paginationTotal = Math.ceil(this.searchResults.length / this.resultsPerPage);

    // this.displayedResults = this.searchResults.slice(0, this.resultsPerPage);
  }

  _onSearchUpdate(e) {
    if( e.state !== 'loaded' ) return;
    console.log('\''+ this.searchTerm +'\''+ ' results: ', e.payload);
    this.displayedResults = (e.payload?.hits || []).map((r, index) => {
      let id = r['@id'];
      let name = r.name?.split('§')?.shift()?.trim();
      let subtitle = r.name?.split('§')?.pop()?.trim();
      let numberOfWorks = (r['_inner_hits']?.filter(h => h['@type'] === 'Authored') || []).length;

      // let numberOfGrants = (r['_inner_hits']['@graph'].hits.hits.filter(h => h['@type'] === 'IP') || []).length;

      return {
        position: index+1,
        id,
        name,
        subtitle,
        numberOfWorks,
        // numberOfGrants
      }
    });

    this.totalResultsCount = e.payload.total;
    this.paginationTotal = Math.ceil(this.totalResultsCount / this.resultsPerPage);
    // this.requestUpdate();
  }

  /**
   * @method _selectAll
   * @description bound to click events of Select All checkbox
   *
   * @param {Object} e click|keyup event
   */
  _selectAll(e) {
    let checkboxes = [];
    let resultRows = (this.shadowRoot.querySelectorAll('app-search-result-row') || []);
    resultRows.forEach(row => {
      checkboxes.push(...row.shadowRoot.querySelectorAll('input[type="checkbox"]') || []);
    });

    checkboxes.forEach(checkbox => {
      checkbox.checked = e.currentTarget.checked;
    });
  }

  /**
   * @method _onPaginationChange
   * @description bound to click events of the pagination element
   *
   * @param {Object} e click|keyup event
   */
  async _onPaginationChange(e) {
    e.detail.startIndex = e.detail.page * this.resultsPerPage - this.resultsPerPage;
    let maxIndex = e.detail.page * (e.detail.startIndex || this.resultsPerPage);
    if( maxIndex > this.searchResults.length ) maxIndex = this.searchResults.length;

    // this.displayedResults = this.searchResults.slice(e.detail.startIndex, maxIndex);
    this.currentPage = e.detail.page;
    await this.SearchModel.search(this.searchTerm, this.currentPage, this.resultsPerPage);
    window.scrollTo(0, 0);
  }

  /**
   * @method _downloadClicked
   * @description bound to download button click event
   *
   * @param {Object} e click|keyup event
   */
  _downloadClicked(e) {
    e.preventDefault();
    console.log('download clicked');

    //   let text = this.citations.map(c => c.ris).join('\n');
    //   let blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    //   let url = URL.createObjectURL(blob);
    //   console.log('url', url)

    //   const link = document.createElement('a');
    //   link.setAttribute('href', url);
    //   link.setAttribute('download', 'data.txt');
    //   link.style.display = 'none';
    //   document.body.appendChild(link);
    //   link.click();
    //   document.body.removeChild(link);
  }

}

customElements.define('app-search', AppSearch);
