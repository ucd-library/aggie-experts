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
      filterByExpertName : { type : String },
      globalAggregations : { type : Object },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'SearchModel', 'ExpertModel');

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
    this.globalAggregations = {};
    this.filteringByGrants = false;
    this.filteringByWorks = false;

    this.render = render.bind(this);
  }

  firstUpdated() {
    if( this.AppStateModel.location.page !== 'search' ) return;

    this._updateFilters();
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

    this._updateFilters();
    this._onSearch({ detail: this.searchTerm });
  }

  _updateFilters() {
    let searchTerm = decodeURIComponent(this.AppStateModel.location.query?.q || this.AppStateModel.location.path?.[1] || '');
    if( !searchTerm ) {
      this.AppStateModel.setLocation('/');
      return;
    }

    let query = this.AppStateModel.location.query;
    this.lastQueryParams = query;

    // if url contains query params, then parse filters before searching
    if( Object.keys(query).length ) {
      this.searchTerm = decodeURI(query.q);

      if( query.type ) this.type = query.type;

      if( query.expert ) {
        this.filterByExpert = true;
        this.filterByExpertId = query.expert;
      } else {
        this.filterByExpert = false;
        this.filterByExpertId = '';
        this.filterByExpertName = '';
      }

      this.collabProjects = query.availability?.includes('collab') ? true : false;
      this.commPartner = query.availability?.includes('community') ? true : false;
      this.industProjects = query.availability?.includes('industry') ? true : false;
      this.mediaInterviews = query.availability?.includes('media') ? true : false;

      let page = this.AppStateModel.location?.path?.[1];
      if( page ) this.currentPage = page;

      this.resultsPerPage = parseInt(this.AppStateModel.location?.path?.[2] || 25);
    } else {
      // no query params, so clear filters
      this.type = '';
      this.status = '';
      this.filterByExpert = false;
      this.filterByExpertId = '';
      this.filterByExpertName = '';
      this.commPartner = false;
      this.collabProjects = false;
      this.industProjects = false;
      this.mediaInterviews = false;

      // update search term
      this.searchTerm = decodeURI(this.AppStateModel.location.path?.[1]);

      let page = this.AppStateModel.location?.path?.[2];
      if( page ) this.currentPage = page;

      this.resultsPerPage = parseInt(this.AppStateModel.location?.path?.[3] || 25);
    }

    // hack for checkboxes not updating consistently even with requestUpdate (mostly an issue with back/forward buttons)
    this.shadowRoot.querySelector('#collab-projects').checked = this.collabProjects;
    this.shadowRoot.querySelector('#comm-partner').checked = this.commPartner;
    this.shadowRoot.querySelector('#indust-projects').checked = this.industProjects;
    this.shadowRoot.querySelector('#media-interviews').checked = this.mediaInterviews;

    // hide/show filters depending on filter type, later will add date filters etc
    this.showOpenTo = this.type === 'expert';
  }

  /**
   * @method _onPageSizeChange
   * @description bound to change events of the page size select element
   *
   * @param {Object} e
   *
   */
  _onPageSizeChange(e) {
    this.resultsPerPage = parseInt(e.currentTarget.value);
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
    this.filteringByGrants = true;
    this.filteringByWorks = false;

    if( this.filterByExpertId && this.filterByExpertName ) {
      this.filterByExpert = true;
      this.addingFilter = true;
      this.AppStateModel.set({ resetSearch : false });
      this._updateLocation();
    }
  }

  /**
   * @method _filterByWorks
   * @description filter by works
   * @param {Object} e
   */
  _filterByWorks(e) {
    // filter by works for this expert
    this.filterByExpertId = e.detail.id;
    this.filterByExpertName = e.detail.name;
    this.filteringByGrants = false;
    this.filteringByWorks = true;

    if( this.filterByExpertId && this.filterByExpertName ) {
      this.filterByExpert = true;
      this.addingFilter = true;
      this.AppStateModel.set({ resetSearch : false });
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
    this.filteringByGrants = false;
    this.filteringByWorks = false;
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

    let availability = utils.buildSearchAvailability({
      collabProjects : this.collabProjects,
      commPartner : this.commPartner,
      industProjects : this.industProjects,
      mediaInterviews : this.mediaInterviews
    });

    if( resetPage ) {
      this.currentPage = 1;

      // TODO reset selected download boxes
      this._updateLocation();
    }

    this._onSearchUpdate(
      await this.SearchModel.search(
        utils.buildSearchQuery(
          this.searchTerm,
          this.currentPage,
          this.resultsPerPage,
          availability,
          this.AppStateModel.location.query.type,
          this.AppStateModel.location.query.status,
          this.filterByExpertId
        )
      ),
      true
    );
  }

  /**
   * @method _updateLocation
   * @description update the url with the current search filters/search term
   */
  _updateLocation() {
    if( this.addingFilter && this.filterByExpert ) {
      if( this.filteringByGrants ) this.type = 'grant';
      if( this.filteringByWorks ) this.type = 'work';
      this.addingFilter = false;
    }

    // url should be /search/<searchTerm> if no search filters, otherwise /search?=<searchTerm>&availability=collab,community,industry,media etc
    let availability = [];
    if( this.collabProjects ) availability.push('collab');
    if( this.commPartner ) availability.push('community');
    if( this.industProjects ) availability.push('industry');
    if( this.mediaInterviews ) availability.push('media');

    let hasQueryParams = availability.length || this.type.length || this.filterByExpert || this.status.length;

    let path = hasQueryParams ? '/search' : `/search/${encodeURIComponent(this.searchTerm)}`;
    if( this.currentPage > 1 || this.resultsPerPage > 25 ) path += `/${this.currentPage}`;
    if( this.resultsPerPage > 25 ) path += `/${this.resultsPerPage}`;

    if( hasQueryParams ) path += `?q=${encodeURIComponent(this.searchTerm)}`;
    if( availability.length ) path += `&availability=${availability.join(',')}`;
    if( this.type.length ) path += `&type=${this.type}`;
    if( this.status.length ) path += `&status=${this.status}`;
    if( this.filterByExpert ) path += `&expert=${this.filterByExpertId}`;

    this.AppStateModel.setLocation(path);
  }

  async _onSearchUpdate(e, fromSearchPage=false) {
    if( e?.state !== 'loaded' || !fromSearchPage ) return;

    if( this.filterByExpert && this.filterByExpertId && !this.filterByExpertName ) {
      this.filterByExpertName = await this._getExpertNameById(this.filterByExpertId);
    }

    this.rawSearchData = JSON.parse(JSON.stringify(e.payload));

    this.globalAggregations = this.rawSearchData['global_aggregations'] || {};

    this.displayedResults = (e.payload?.hits || []).map((r, index) => {
      let resultType = '';
      if( r['@type'] === 'Grant' || r['@type']?.includes?.('Grant') ) resultType = 'grant';
      if( r['@type'] === 'Expert' || r['@type']?.includes?.('Expert') ) resultType = 'expert';
      if( r['@type'] === 'Work' || r['@type']?.includes?.('Work') ) resultType = 'work';

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
        subtitle = ((r.name?.split('§') || [])[1] || '').trim();

        let pi = subtitle.split('•').pop().trim();
        if( pi ) {
          pi = 'PI: ' + pi;
          subtitle = subtitle.split('•').slice(0, -1).join('•').trim() + '• ' + pi;
        }

        subtitle = 'Grant <span class="dot-separator">•</span> ' + subtitle.trim().replaceAll('•', '<span class="dot-separator">•</span>');
        id = 'grant/' + id;
      } else if( resultType === 'work' ) {
        subtitle = '';
        // parse work type + date + authors from subtitle
        // ie '“A Chinaman’s Chance” in Court: Asian Pacific Americans and Racial Rules of Evidence §  • article-journal • 2013-12-01 • Chin, G. § UC Irvine Law Review • 2327-4514 § '
        let subtitleParts = ((r.name?.split('§') || [])[1] || '')?.split('•')?.slice?.(1) || [];
        if( subtitleParts.length ) {
          let type = subtitleParts[0]?.trim() || '';
          if( type ) subtitle += utils.getCitationType(type) + ' <span class="dot-separator">•</span> ';

          let date = subtitleParts[1]?.trim() || '';
          if( date ) {
            let [ year, month, day ] = date.split?.('-');
            subtitle += utils.formatDate({ year, month, day }) + ' <span class="dot-separator">•</span> ';
          }

          let authors = subtitleParts[2]?.trim() || '';
          if( authors ) subtitle += authors;
        }
        id = 'work/' + id;
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
   * @method _getExpertNameById
   * @description get expert name given an expertId
   *
   * @param {String} expertId
   */
  async _getExpertNameById(expertId='') {
    let expert = await this.ExpertModel.get(expertId, '', utils.getExpertApiOptions({
      includeWorks : false,
      includeGrants : false
    }));
    return expert.payload?.name?.split?.('§')?.[0]?.trim() || '';
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

    let availability = utils.buildSearchAvailability({
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
          availability,
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

    debugger;
    // TODO need to build grants vs works file

    // Title | Funding Agency | Grant Id | Start Date | End Date | Type of Grant | Known Contributors (List of PIs and CoPIs)
    // I realized Role is not helpful here as the grants are not attached to people in that filtered view. Can you make that a concatenated "Known Contributors" column?




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
    this.currentPage = 1;
    this._uncheckDownloads();

    if( !['grant', 'work'].includes(this.type) && this.filterByExpert ) {
      this._removeExpertFilter();
    }

    this._updateLocation();
  }

  _onSubFilterChange(e) {
    // update url with search filters
    this.type = e.detail.type;
    this.status = e.detail.status;

    this.currentPage = 1;
    this._uncheckDownloads();
    this._updateLocation();
  }

  _uncheckDownloads() {
    let resultRows = (this.shadowRoot.querySelectorAll('app-search-result-row') || []);
    resultRows.forEach(row => {
      let checkbox = row.shadowRoot.querySelector('input[type="checkbox"]');
      if( checkbox ) checkbox.checked = false;
    });

    let selectAll = this.shadowRoot.querySelector('#select-all');
    if( selectAll ) selectAll.checked = false;
  }

}

customElements.define('app-search', AppSearch);
