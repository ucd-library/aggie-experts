import { LitElement } from 'lit';
import {render} from "./app-search.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";

import "../../components/search-box";
import "../../components/search-result-row";
import "../../components/category-filter-controller.js";
// import '../../components/date-range-filter.js';
// import '../../components/histogram.js';

import utils from '../../../lib/utils';

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
      rawSearchData : { type : Object },
      resultsLoading : { type : String },
      filters : { type : Array },
      refineSearchCollapsed : { type : Boolean },
      collabProjects : { type : Boolean },
      commPartner : { type : Boolean },
      industProjects : { type : Boolean },
      mediaInterviews : { type : Boolean },
      refineResultsTo : { type : String },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'SearchModel');

    this.searchTerm = '';
    this.lastQueryParams = {};
    this.searchResults = [];
    this.displayedResults = [];
    this.paginationTotal = 1;
    this.currentPage = 1;
    this.resultsPerPage = 25;
    this.totalResultsCount = 0;
    this.rawSearchData = {};
    this.resultsLoading = '...';
    this.refineSearchCollapsed = true;
    this.collabProjects = false;
    this.commPartner = false;
    this.industProjects = false;
    this.mediaInterviews = false;
    this.refineResultsTo = '';

    this.filters = [
      { label: 'All Results', count: 1000, icon: 'fa-infinity', active: true },
      { label: 'Experts', count: 100, icon: 'fa-user', active: false },
      { label: 'Grants', count: 50, icon: 'fa-file-invoice-dollar', active: false },
      // { label: 'Works', count: 500, icon: 'fa-book-open', active: false },
      // { label: 'Subjects', count: 350, icon: 'lightbulb-on', active: false }
    ];

    this.render = render.bind(this);
  }

  firstUpdated() {
    if( this.AppStateModel.location.page !== 'search' ) return;

    let query = this.AppStateModel.location.query;
    this.lastQueryParams = query;

    // if url contains query params, then parse filters before searching
    if( Object.keys(query).length ) {
      this.searchTerm = decodeURI(query.q);

      if( query.refineResultsTo ) this.refineResultsTo = query.refineResultsTo;
      this.filters = this.filters.map(f => {
        f.active = f.label.toLowerCase() === this.refineResultsTo || (!this.refineResultsTo && f.label === 'All Results');
        return f;
      });

      this.collabProjects = query.hasAvailability?.includes('collab');
      this.commPartner = query.hasAvailability?.includes('community');
      this.industProjects = query.hasAvailability?.includes('industry');
      this.mediaInterviews = query.hasAvailability?.includes('media');

      if( query.hasAvailability?.includes('ark:') ) {
        if( query.hasAvailability.includes('ark:/87287/d7mh2m/keyword/c-ucd-avail/Community partnerships') ) this.commPartner = true;
        if( query.hasAvailability.includes('ark:/87287/d7mh2m/keyword/c-ucd-avail/Collaborative projects') ) this.collabProjects = true;
        if( query.hasAvailability.includes('ark:/87287/d7mh2m/keyword/c-ucd-avail/Industry Projects') ) this.industProjects = true;
        if( query.hasAvailability.includes('ark:/87287/d7mh2m/keyword/c-ucd-avail/Media enquiries') ) this.mediaInterviews = true;
        this._updateLocation();
      }

      let page = this.AppStateModel.location?.path?.[1];
      if( page ) this.currentPage = page;

      let resultsPerPage = this.AppStateModel.location?.path?.[2];
      if( resultsPerPage ) this.resultsPerPage = resultsPerPage;

      this._onSearch({ detail: this.searchTerm });
      return;
    }

    // update search term
    this.searchTerm = decodeURI(this.AppStateModel.location.path?.[1]);

    let page = this.AppStateModel.location?.path?.[2];
    if( page ) this.currentPage = page;

    let resultsPerPage = this.AppStateModel.location?.path?.[3];
    if( resultsPerPage ) this.resultsPerPage = resultsPerPage;

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

    let searchTerm = decodeURIComponent(e.location.query?.q || e.location.path?.[1] || '');

    if( JSON.stringify(e.location.query) === JSON.stringify(this.lastQueryParams) && searchTerm === this.searchTerm ) return;

    this.lastQueryParams = e.location.query;

    this.collabProjects = (this.lastQueryParams.hasAvailability || '').includes('collab');
    this.commPartner = (this.lastQueryParams.hasAvailability || '').includes('community');
    this.industProjects = (this.lastQueryParams.hasAvailability || '').includes('industry');
    this.mediaInterviews = (this.lastQueryParams.hasAvailability || '').includes('media');

    // hack for checkboxes not updating consistently even with requestUpdate (mostly an issue with back/forward buttons)
    this.shadowRoot.querySelector('#collab-projects').checked = this.collabProjects;
    this.shadowRoot.querySelector('#comm-partner').checked = this.commPartner;
    this.shadowRoot.querySelector('#indust-projects').checked = this.industProjects;
    this.shadowRoot.querySelector('#media-interviews').checked = this.mediaInterviews;

    this.totalResultsCount = null;
    this.searchTerm = searchTerm;

    this._onSearch({ detail: this.searchTerm });
  }

  /**
   * @method _onPageSizeChange
   * @description bound to change events of the page size select element
   *
   * @param {Object} e
   *
   */
  _onPageSizeChange(e) {
    this.resultsPerPage = e.currentTarget.value;
    this.currentPage = 1;

    this._updateLocation();

    this._onSearch({ detail: this.searchTerm }, true); // reset to first page
  }

  /**
   * @method _onSearch
   * @description called from the search box button is clicked or
   * the enter key is hit. search
   * @param {Object} e
   * @param {Boolean} resetPage reset pagination to page 1
   */
  async _onSearch(e, resetPage=false) {
    if( !e.detail?.trim().length ) return;

    // update url
    this.searchTerm = e.detail.trim();
    this.totalResultsCount = null;

    let hasAvailability = utils.buildSearchAvailability({
      collabProjects : this.collabProjects,
      commPartner : this.commPartner,
      industProjects : this.industProjects,
      mediaInterviews : this.mediaInterviews
    });

    if( resetPage ) {
      this.currentPage = 1;
      this._updateLocation();
    }

    this._onSearchUpdate(await this.SearchModel.search(this.searchTerm, this.currentPage, this.resultsPerPage, hasAvailability));
  }

  _updateLocation() {
    // url should be /search/<searchTerm> if no search filters, otherwise /search?=<searchTerm>&hasAvailability=collab,community,industry,media etc
    let hasAvailability = [];
    if( this.collabProjects ) hasAvailability.push('collab');
    if( this.commPartner ) hasAvailability.push('community');
    if( this.industProjects ) hasAvailability.push('industry');
    if( this.mediaInterviews ) hasAvailability.push('media');

    // TODO also need to update url with other query params, like for refineResultsTo and date filters
    // /search?q=climate    &hasAvailability=collab,community,industry,media     &refineResultsTo=grants     &startDate=2000&endDate=2025&includeUnknown=true

    let hasQueryParams = hasAvailability.length || this.refineResultsTo.length; // TODO dates

    let path = hasQueryParams ? '/search' : `/search/${encodeURIComponent(this.searchTerm)}`;
    if( this.currentPage > 1 || this.resultsPerPage > 25 ) path += `/${this.currentPage}`;
    if( this.resultsPerPage > 25 ) path += `/${this.resultsPerPage}`;

    if( hasQueryParams ) path += `?q=${encodeURIComponent(this.searchTerm)}`;
    if( hasAvailability.length ) path += `&hasAvailability=${hasAvailability.join(',')}`;
    if( this.refineResultsTo.length ) path += `&refineResultsTo=${this.refineResultsTo}`;

    this.AppStateModel.setLocation(path);
  }

  _onSearchUpdate(e) {
    if( e?.state !== 'loaded' ) return;
    this.rawSearchData = JSON.parse(JSON.stringify(e.payload));

    this.displayedResults = (e.payload?.hits || []).map((r, index) => {
      let id = r['@id'];
      if( Array.isArray(r.name) ) r.name = r.name[0];
      let name = r.name?.split('§')?.shift()?.trim();
      let subtitle = r.name?.split('§')?.pop()?.trim();
      if( name === subtitle ) subtitle = '';
      let numberOfWorks = (r['_inner_hits']?.filter(h => h['@type']?.includes('Work')) || []).length;
      let numberOfGrants = (r['_inner_hits']?.filter(h => h['@type']?.includes('Grant')) || []).length;

      return {
        position: index+1,
        id,
        name,
        subtitle,
        numberOfWorks,
        numberOfGrants
      }
    });

    this.totalResultsCount = e.payload.total;
    this.paginationTotal = Math.ceil(this.totalResultsCount / this.resultsPerPage);
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

    this._updateLocation();

    let hasAvailability = utils.buildSearchAvailability({
      collabProjects : this.collabProjects,
      commPartner : this.commPartner,
      industProjects : this.industProjects,
      mediaInterviews : this.mediaInterviews
    });
    this._onSearchUpdate(await this.SearchModel.search(this.searchTerm, this.currentPage, this.resultsPerPage, hasAvailability));
    window.scrollTo(0, 0);
  }

  /**
   * @method _selectCollabProjects
   * @description bound to change events of the collab projects checkbox
   * @param {Object} e change event
   */
  _selectCollabProjects(e) {
    this.collabProjects = e.currentTarget.checked;
    this.currentPage = 1;
    this._updateLocation();
  }

  /**
   * @method _selectCommPartner
   * @description bound to change events of the community partnerships checkbox
   * @param {Object} e change event
   */
  _selectCommPartner(e) {
    this.commPartner = e.currentTarget.checked;
    this.currentPage = 1;
    this._updateLocation();
  }

  /**
   * @method _selectIndustProjects
   * @description bound to change events of the industry projects checkbox
   * @param {Object} e change event
   */
  _selectIndustProjects(e) {
    this.industProjects = e.currentTarget.checked;
    this.currentPage = 1;
    this._updateLocation();
  }

  /**
   * @method _selectMediaInterviews
   * @description bound to change events of the media interviews checkbox
   * @param {Object} e change event
   */
  _selectMediaInterviews(e) {
    this.mediaInterviews = e.currentTarget.checked;
    this.currentPage = 1;
    this._updateLocation();
  }

  /**
   * @method _downloadClicked
   * @description bound to download button click event
   *
   * @param {Object} e click|keyup event
   */
  async _downloadClicked(e) {
    e.preventDefault();

    let selectedPersons = [];
    let resultRows = (this.shadowRoot.querySelectorAll('app-search-result-row') || []);
    resultRows.forEach(row => {
      let checkbox = row.shadowRoot.querySelector('input[type="checkbox"]');
      if( checkbox?.checked ) {
        selectedPersons.push(row.result.id);
      }
    });

    if( !selectedPersons.length ) return;

    // columns for the spreadsheet:
    //  Name | Aggie Experts Webpage | # of works that match the keyword | Number of grants that match the keyword | URLs from the profile

    let body = [];
    let hits = (this.rawSearchData?.hits || []);
    for( let h = 0; h < hits.length; h++ ) {
      let result = hits[h];
      if( selectedPersons.includes(result['@id']) ) {
        let name = result.name?.split('§')?.[0]?.trim();
        let landingPage = 'https://experts.ucdavis.edu/' + result['@id'];
        let numberOfWorks = (result['_inner_hits']?.filter(h => h['@type']?.includes('Work')) || []).length;
        let numberOfGrants = (result['_inner_hits']?.filter(h => h['@type']?.includes('Grant')) || []).length;
        let urls = (result.contactInfo?.hasURL || []).map(w => w.url.trim()).join('; ');

        body.push([
          '"' + name + '"',
          '"' + landingPage + '"',
          '"' + numberOfWorks + '"',
          '"' + numberOfGrants + '"',
          '"' + urls + '"'
        ]);
      }
    }

    if( !body.length ) return;

    let headers = ['Name', 'Aggie Experts Webpage', 'Number of works that match the keyword', 'Number of grants that match the keyword', 'URLs from the profile'];
    let text = headers.join(',') + '\n';
    body.forEach(row => {
      text += row.join(',') + '\n';
    });

    let blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'data.csv');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  _onFilterChange(e) {
    // update url with search filters
    this.refineResultsTo = e.detail.label;
    if( this.refineResultsTo === 'all results' ) this.refineResultsTo = '';
    this.currentPage = 1;
    this._updateLocation();
  }

}

customElements.define('app-search', AppSearch);
