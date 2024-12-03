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
      // filters : { type : Array },
      refineSearchCollapsed : { type : Boolean },
      collabProjects : { type : Boolean },
      commPartner : { type : Boolean },
      industProjects : { type : Boolean },
      mediaInterviews : { type : Boolean },
      type : { type : String },
      status : { type : String },
      showOpenTo : { type : Boolean },
      filterByExpert : { type : Boolean },
      filterByExpertId : { type : String },
      filterByExpertName : { type : String }
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
    this.type = '';
    this.status = '';
    this.showOpenTo = false;
    this.filterByExpert = false;
    this.filterByExpertId = '';
    this.filterByExpertName = '';

    this.render = render.bind(this);
  }

  firstUpdated() {
    if( this.AppStateModel.location.page !== 'search' ) return;

    let query = this.AppStateModel.location.query;
    this.lastQueryParams = query;

    this._updateAvailableFilters();

    // if url contains query params, then parse filters before searching
    if( Object.keys(query).length ) {
      this.searchTerm = decodeURI(query.q);

      if( query.type ) this.type = query.type;


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

      this._updateAvailableFilters();

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
    this.type = e.location?.query?.type || '';
    this.status = e.location?.query?.status || '';

    this._updateAvailableFilters();

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
   * @method _filterByGrants
   * @description filter by grants
   * @param {Object} e
   */
  _filterByGrants(e) {
    // TODO eventually multiple experts could be supported, for now just one needed
    // filter by grants for this expert
    this.filterByExpertId = e.detail.id;
    this.filterByExpertName = e.detail.name;
    if( this.filterByExpertId && this.filterByExpertName ) {
      this.filterByExpert = true;
      this.addingFilter = true;
      this._updateLocation();
    }
  }

  /**
   * @method _removeExpertFilter
   * @description remove the expert filter
   */
  _removeExpertFilter(e) {
    this.filterByExpert = false;
    this.filterByExpertId = '';
    this.filterByExpertName = '';
    this._updateLocation();
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

    this._onSearchUpdate(
      await this.SearchModel.search(
        utils.buildSearchQuery(
          this.searchTerm,
          this.currentPage,
          this.resultsPerPage,
          hasAvailability,
          this.AppStateModel.location.query.type,
          this.AppStateModel.location.query.status,
          this.filterByExpertId
        )
      ),
      true
    );
  }

  _updateLocation() {
    if( this.addingFilter && this.filterByExpert ) {
      this.type = 'grant';
      this.addingFilter = false;
    }

    // url should be /search/<searchTerm> if no search filters, otherwise /search?=<searchTerm>&hasAvailability=collab,community,industry,media etc
    let hasAvailability = [];
    if( this.collabProjects ) hasAvailability.push('collab');
    if( this.commPartner ) hasAvailability.push('community');
    if( this.industProjects ) hasAvailability.push('industry');
    if( this.mediaInterviews ) hasAvailability.push('media');

    let hasQueryParams = hasAvailability.length || this.type.length || this.filterByExpert || this.status.length;

    let path = hasQueryParams ? '/search' : `/search/${encodeURIComponent(this.searchTerm)}`;
    if( this.currentPage > 1 || this.resultsPerPage > 25 ) path += `/${this.currentPage}`;
    if( this.resultsPerPage > 25 ) path += `/${this.resultsPerPage}`;

    if( hasQueryParams ) path += `?q=${encodeURIComponent(this.searchTerm)}`;
    if( hasAvailability.length ) path += `&hasAvailability=${hasAvailability.join(',')}`;
    if( this.type.length ) path += `&type=${this.type}`;
    if( this.status.length ) path += `&status=${this.status}`;
    if( this.filterByExpert ) path += `&expert=${this.filterByExpertId}`;

    this.AppStateModel.setLocation(path);
  }

  _onSearchUpdate(e, fromSearchPage=false) {
    if( e?.state !== 'loaded' || !fromSearchPage ) return;

    // console.log('parsing new search results', e, fromSearchPage);
    this.rawSearchData = JSON.parse(JSON.stringify(e.payload));

    this.displayedResults = (e.payload?.hits || []).map((r, index) => {
      let resultType = '';
      if( r['@type'] === 'Grant' || r['@type']?.includes?.('Grant') ) resultType = 'grant';
      if( r['@type'] === 'Expert' || r['@type']?.includes?.('Expert') ) resultType = 'expert';

      let id = r['@id'];
      if( Array.isArray(r.name) ) r.name = r.name[0];
      let name = r.name?.split('§')?.shift()?.trim();

      let subtitle, numberOfWorks, numberOfGrants;

      if( resultType === 'expert' ) {
        subtitle = r.name?.split('§')?.pop()?.trim();
        if( name === subtitle ) subtitle = '';
        numberOfWorks = (r['_inner_hits']?.filter(h => h['@type']?.includes('Work')) || []).length;
        numberOfGrants = (r['_inner_hits']?.filter(h => h['@type']?.includes('Grant')) || []).length;

      } else if( resultType === 'grant' ) {
        subtitle = ((r.name?.split('§') || [])[1] || '').trim().replaceAll('•', '<span class="dot-separator">•</span>');
        id = 'grant/' + id;
      }

      return {
        resultType,
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

    this.requestUpdate();
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

    this._onSearchUpdate(
      await this.SearchModel.search(
        utils.buildSearchQuery(
          this.searchTerm,
          this.currentPage,
          this.resultsPerPage,
          hasAvailability,
          this.AppStateModel.location.query.type,
          this.AppStateModel.location.query.status,
          this.filterByExpertId
        )
      ),
      true
    );

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
    this.type = e.detail.type;
    this.status = '';
    if( this.type === 'all results' ) this.type = '';
    this._updateAvailableFilters();
    this.currentPage = 1;
    this._updateLocation();
  }

  _onSubFilterChange(e) {
    // update url with search filters
    this.type = e.detail.type;
    this.status = e.detail.status;
    this._updateAvailableFilters();

    this.currentPage = 1;
    this._updateLocation();
  }

  _updateAvailableFilters() {
    this.showOpenTo = !this.type || this.type === 'expert';
    // TODO others, dates hidden when viewing Experts
  }

}

customElements.define('app-search', AppSearch);
