import { LitElement, html } from 'lit';
import {render} from "./app-browse-by.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";
import '../../components/ucdlib-browse-az.js';
import '../../components/search-result-row.js';
import '../../components/category-filter-row.js';

import utils from '../../../lib/utils/index.js';
import { AffiliationMixin } from '../AffiliationMixin.js';

// Fallback work-type list shown when aggregations are not yet loaded.
const DEFAULT_WORK_TYPES = [
  { key: 'book', label: 'Books' },
  { key: 'chapter', label: 'Chapters' },
  { key: 'paper-conference', label: 'Conference Papers' },
  { key: 'article-journal', label: 'Journal Articles' },
];

export default class AppBrowseBy extends AffiliationMixin(Mixin(LitElement)
  .with(LitCorkUtils)) {

  static get properties() {
    return {
      browseType : { type : String, attribute : 'browse-type' },
      letter : { type : String },
      displayedResults : { type : Array },
      resultsPerPage  : { type : Number },
      currentPage : { type : Number },
      totalResultsCount : { type : Number },
      paginationTotal : { type : Number },
      // filters
      dept : { type : Array },
      status : { type : String },
      workType : { type : String },
      collabProjects : { type : Boolean },
      commPartner : { type : Boolean },
      industProjects : { type : Boolean },
      mediaInterviews : { type : Boolean },
      filterByDate : { type : Boolean },
      filterByDateLabel : { type : String },
      dateFrom : { type : String },
      dateTo : { type : String },
      dateRangeData : { type : Array },
      affiliationCollapsed : { type : Boolean },
      dateCollapsed : { type : Boolean },
      openToCollapsed : { type : Boolean },
      affiliationSearch : { type : String },
      expandedSubCategories : { type : Array },
      categoryAggregations : { type : Object },
      refineSearchCollapsed : { type : Boolean },
      mobileCategoryOpen : { type : Boolean },
    }
  }

  constructor() {
    super(); // AffiliationMixin constructor initialises this.orgLookup
    this.render = render.bind(this);

    this.browseType = '';
    this.letter = '';
    this.displayedResults = [];
    this.resultsPerPage = 25;
    this.currentPage = 1;
    this.totalResultsCount = 0;
    this.paginationTotal = 0;

    this.dept = [];
    this.status = '';
    this.workType = '';
    this.collabProjects = false;
    this.commPartner = false;
    this.industProjects = false;
    this.mediaInterviews = false;
    this.filterByDate = false;
    this.filterByDateLabel = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.dateRangeData = [];
    this._lastDateHistSig = '';
    this.refineSearchCollapsed = true;
    this.mobileCategoryOpen = false;
    this.affiliationCollapsed = true;
    this.dateCollapsed = true;
    this.openToCollapsed = true;
    this.affiliationSearch = '';
    this.expandedSubCategories = [];
    this.categoryAggregations = {};

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

    let page = e.location.path[3];
    let resultsPerPage = e.location.path[4];
    let query = e.location.query || {};

    this.dept = (query.dept || query.deptCodesIncluded)
      ? this._deserializeDept(query.dept || '', query.deptCodesIncluded || '', query.deptCodesExcluded || '')
      : [];
    this.status = query.status || '';
    this.workType = query.type || '';
    this.collabProjects = query.availability?.includes('collab') || false;
    this.commPartner = query.availability?.includes('community') || false;
    this.industProjects = query.availability?.includes('industry') || false;
    this.mediaInterviews = query.availability?.includes('media') || false;
    this.dateFrom = query.dateFrom || '';
    this.dateTo = query.dateTo || '';
    if( this.dateFrom || this.dateTo ) {
      this.filterByDate = true;
      this.filterByDateLabel = (this.dateFrom || '') + ' - ' + (this.dateTo || '');
    } else {
      this.filterByDate = false;
      this.filterByDateLabel = '';
    }

    this.displayedResults = [];

    if( this.letter ) {
      this.currentPage = !isNaN(page) ? parseInt(page) : 1;
      this.resultsPerPage = parseInt(resultsPerPage) ? resultsPerPage : 25;

      const filters = this._buildFilters();

      if( this.browseType === 'expert' ) {
        this._onBrowseExpertsUpdate(await this.BrowseByModel.browseBy('expert', this.letter, this.currentPage, this.resultsPerPage, filters));
      } else if( this.browseType === 'grant' ) {
        this._onBrowseGrantsUpdate(await this.BrowseByModel.browseBy('grant', this.letter, this.currentPage, this.resultsPerPage, filters));
      } else if( this.browseType === 'work' ) {
        this._onBrowseWorksUpdate(await this.BrowseByModel.browseBy('work', this.letter, this.currentPage, this.resultsPerPage, filters));
      }
    }

    // fetch category aggregations (counts for All/Active/etc.) scoped to active filters
    await this._fetchCategoryAggregations();
  }

  /**
   * @method _buildFilters
   * @description build filter params object from current UI state
   * @returns {Object} filter params for BrowseByModel
   */
  _buildFilters() {
    const filters = {};
    if( this.dept?.length ) filters.dept = this._deptCodesToNames(this.dept);
    if( this.status ) filters.status = [this.status];
    if( this.workType ) filters.type = [this.workType];
    if( this.dateFrom ) filters.dateFrom = this.dateFrom;
    if( this.dateTo ) filters.dateTo = this.dateTo;
    if( this.browseType === 'expert' ) {
      const availability = [];
      if( this.collabProjects ) availability.push('Collaborative projects');
      if( this.commPartner ) availability.push('Community partnerships');
      if( this.industProjects ) availability.push('Industry Projects');
      if( this.mediaInterviews ) availability.push('Media enquiries');
      if( availability.length ) filters.availability = availability;
    }
    return filters;
  }

  /**
   * @method _fetchCategoryAggregations
   * @description fetch aggregation counts for the category filter rows, scoped to
   * active dept/date filters but without status or type so all category buckets are returned
   * @returns {Promise}
   */
  async _fetchCategoryAggregations() {
    if( this.browseType !== 'grant' && this.browseType !== 'work' ) return;
    try {
      const filters = this._buildFilters();
      delete filters.status;
      delete filters.type;
      const result = await this.BrowseByModel.browseCounts(this.browseType, filters);
      if( result?.state === 'loaded' ) {
        this.categoryAggregations = result.payload?.aggregations || {};
      }
    } catch(e) {
      // ignore - counts will just be empty
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
      this.totalResultsCount = 0;
      this.paginationTotal = 0;
      this._updateDateRangeData(e.payload?.aggregations);
      return;
    }
    this._updateDateRangeData(e.payload?.aggregations);
    this._buildResults(e.payload?.hits, e.payload?.total, '', 'expert');
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
      this.totalResultsCount = 0;
      this.paginationTotal = 0;
      this._updateDateRangeData(e.payload?.aggregations);
      return;
    }
    this._updateDateRangeData(e.payload?.aggregations);
    this._buildResults(e.payload?.hits, e.payload?.total, 'grant/', 'grant');
  }

  /**
   * @method _onBrowseWorksUpdate
   * @description bound to BrowseByModel browse-works-update event
   *
   * @param {Object} e
   * @returns {Promise}
   */
  _onBrowseWorksUpdate(e) {
    if( e.state !== 'loaded' ) return;
    if( !e.payload?.hits?.length ) {
      this.displayedResults = [];
      this.totalResultsCount = 0;
      this.paginationTotal = 0;
      this._updateDateRangeData(e.payload?.aggregations);
      return;
    }
    this._updateDateRangeData(e.payload?.aggregations);
    this._buildResults(e.payload?.hits, e.payload?.total, 'work/', 'work');
  }

  /**
   * @method _computeAggSignature
   * @description compute the aggregation signature for the current browse state (excludes date range)
   * @returns {String} JSON string identifying the current non-date filter state
   */
  _computeAggSignature() {
    return JSON.stringify({
      browseType: this.browseType,
      letter: this.letter,
      dept: this.dept,
      status: this.status,
      workType: this.workType,
      collabProjects: this.collabProjects,
      commPartner: this.commPartner,
      industProjects: this.industProjects,
      mediaInterviews: this.mediaInterviews,
    });
  }

  /**
   * @method _buildHistogramDataFromAgg
   * @description build histogram data array from aggregation results
   * @param {Object} aggs aggregations from the API response
   * @returns {Array} array of {stat: year, value: count} objects
   */
  _buildHistogramDataFromAgg(aggs) {
    const aggToEntries = (agg) => {
      if( !agg || typeof agg !== 'object' ) return [];
      return Object.entries(agg).map(([k, count]) => ({ key: parseInt(k), doc_count: count }));
    };

    let yearMap = new Map();
    if( this.browseType === 'work' ) {
      aggToEntries(aggs.work_years).forEach(b => {
        const yr = new Date(b.key).getUTCFullYear();
        yearMap.set(yr, (yearMap.get(yr) || 0) + b.doc_count);
      });
    } else if( this.browseType === 'grant' ) {
      aggToEntries(aggs.grant_years).forEach(b => {
        const yr = new Date(b.key).getUTCFullYear();
        yearMap.set(yr, (yearMap.get(yr) || 0) + b.doc_count);
      });
    } else if( this.browseType === 'expert' ) {
      aggToEntries(aggs.expert_years).forEach(b => {
        const yr = new Date(b.key).getUTCFullYear();
        yearMap.set(yr, (yearMap.get(yr) || 0) + b.doc_count);
      });
    }

    if( !yearMap.size ) return [];

    const sorted = Array.from(yearMap.entries()).sort((a, b) => a[0] - b[0]);
    const minY = sorted[0][0];
    const maxY = sorted[sorted.length - 1][0];
    const data = [];
    for( let y = minY; y <= maxY; y++ ) {
      data.push({ stat: y, value: yearMap.get(y) || 0 });
    }
    return data;
  }

  /**
   * @method _updateDateRangeData
   * @description update histogram data and range slider from API aggregations.
   * Only rebuilds histogram data when non-date filters change; when only the date
   * range changes the existing histogram is kept so the full range stays visible.
   * @param {Object} aggs aggregations from the API response
   * @returns {Promise}
   */
  async _updateDateRangeData(aggs) {
    if( !aggs ) { this.dateRangeData = []; return; }

    const sig = this._computeAggSignature();
    if( sig === this._lastDateHistSig ) {
      // Non-date filters unchanged — just sync slider handles to current selection
      await this.updateComplete;
      this._refreshRange(false);
      return;
    }
    this._lastDateHistSig = sig;

    const data = this._buildHistogramDataFromAgg(aggs);
    if( !data.length ) { this.dateRangeData = []; return; }

    this.dateRangeData = data;
    await this.updateComplete;
    this._refreshRange(true);
  }

  /**
   * @method _refreshRange
   * @description refresh the range slider(s). When dataChanged is true, pushes
   * new histogram data and clamps min/max to the available range. When false,
   * only syncs the handle positions to the current URL selection.
   * @param {Boolean} dataChanged whether histogram data has changed
   */
  async _refreshRange(dataChanged=false) {
    const ranges = this.shadowRoot?.querySelectorAll('ucdlib-range-slider');
    if( !ranges?.length || !this.dateRangeData.length ) return;
    const absMin = this.dateRangeData[0].stat;
    const absMax = this.dateRangeData[this.dateRangeData.length - 1].stat;
    const urlMin = this.dateFrom ? Number(this.dateFrom) : null;
    const urlMax = this.dateTo ? Number(this.dateTo) : null;
    const clampedMin = urlMin != null ? Math.max(absMin, Math.min(urlMin, absMax)) : absMin;
    const clampedMax = urlMax != null ? Math.max(absMin, Math.min(urlMax, absMax)) : absMax;
    for( const range of ranges ) {
      if( typeof range.refresh === 'function' ) range.refresh(dataChanged);
      if( dataChanged ) {
        range.initialMin = clampedMin;
        range.initialMax = clampedMax;
        range.data = this.dateRangeData;
        range.hideHistogram = false;
      }
      range.min = clampedMin;
      range.max = clampedMax;
    }
  }

  /**
   * @method _buildResults
   * @description build displayedResults from api response data
   *
   * @param {Array} hits api response data
   * @param {Number} total total number of results
   * @param {String} pagePrefix to prepend to the id for links
   * @param {String} resultType type of result to build, defaults to 'expert'
   */
  async _buildResults(hits=[], total=0, pagePrefix='', resultType='expert') {
    this.displayedResults = hits.map((r, index) => {
      let id = r['@id'];
      if( Array.isArray(r.name) ) r.name = r.name[0];
      let name = r.name?.split('§')?.shift()?.trim();
      let subtitle;
      if( resultType === 'expert' ) {
        subtitle = r.name?.split('§')?.pop()?.trim();
        if( name === subtitle ) subtitle = '';
      } else if( resultType === 'grant' ) {
        subtitle = ((r.name?.split('§') || [])[1] || '').trim();
        let [status, dateRange, pi] = subtitle.split('•');

        subtitle = 'Grant';
        if( status ) subtitle += ' <span class="dot-separator">•</span>  ' + status.trim();
        if( dateRange ) subtitle += ' <span class="dot-separator">•</span>  ' + dateRange.trim();
        if( pi ) subtitle += ' <span class="dot-separator">•</span> PI:  ' + pi.trim();
      } else if( resultType === 'work' ) {
        subtitle = '';
        let subtitleParts = ((r.name?.split('§') || [])[1] || '')?.split('•')?.slice?.(1) || [];
        if( subtitleParts.length ) {
          let type = subtitleParts[0]?.trim() || '';
          if( type ) subtitle += utils.getCitationType(type) + ' <span class="dot-separator">•</span> ';

          let date = subtitleParts[1]?.trim() || '';
          if( date ) {
            let [ year ] = date.split?.('-');
            subtitle += utils.formatDate({ year }) + ' <span class="dot-separator">•</span> ';
          }

          let authors = subtitleParts[2]?.trim() || '';
          if( authors ) subtitle += authors;
        }
      }

      return {
        position: index+1,
        id: pagePrefix+id,
        name,
        subtitle
      }
    });

    this.totalResultsCount = total;
    this.paginationTotal = Math.ceil(this.totalResultsCount / this.resultsPerPage);

    await this.updateComplete;
    this.dispatchEvent(new CustomEvent('browse-results-rendered', {
      bubbles: true,
      composed: true
    }));
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

    const qs = this._buildQueryString();
    this.AppStateModel.setLocation(path + (qs ? '?' + qs : ''));

    this.dispatchEvent(
      new CustomEvent("reset-scroll", {
        bubbles : true,
        cancelable : true,
      })
    );
  }

  /**
   * @method _buildQueryString
   * @description build a URL query string from current filter state
   * @returns {String} query string without leading '?'
   */
  _buildQueryString() {
    const params = [];
    if( this.dept?.length ) {
      const { dept, deptCodesIncluded, deptCodesExcluded } = this._serializeDept(this.dept);
      if( dept ) params.push(`dept=${dept}`);
      if( deptCodesIncluded ) params.push(`deptCodesIncluded=${deptCodesIncluded}`);
      if( deptCodesExcluded ) params.push(`deptCodesExcluded=${deptCodesExcluded}`);
    }
    if( this.status ) params.push(`status=${this.status}`);
    if( this.workType ) params.push(`type=${this.workType}`);
    if( this.dateFrom ) params.push(`dateFrom=${this.dateFrom}`);
    if( this.dateTo ) params.push(`dateTo=${this.dateTo}`);
    if( this.browseType === 'expert' ) {
      const avail = [];
      if( this.collabProjects ) avail.push('collab');
      if( this.commPartner ) avail.push('community');
      if( this.industProjects ) avail.push('industry');
      if( this.mediaInterviews ) avail.push('media');
      if( avail.length ) params.push(`availability=${avail.join(',')}`);
    }
    return params.join('&');
  }

  /**
   * @method _updateLocation
   * @description update the URL with the current browse type, letter, and filters
   */
  _updateLocation() {
    const path = `/browse/${this.browseType}/${this.letter || 'a'}`;
    const qs = this._buildQueryString();
    this.AppStateModel.setLocation(path + (qs ? '?' + qs : ''));
  }

  /**
   * @method _removeDeptFilter
   * @description remove a single department filter chip; collapses the affiliation
   * section if no dept filters remain (mirrors app-search.js behaviour)
   * @param {String} code dept code to remove
   */
  _removeDeptFilter(code) {
    this.dept = this.dept.filter(d => d !== code);
    if( !this.dept.length ) this.affiliationCollapsed = false;
    this._updateLocation();
  }

  /**
   * @method _renderFilterContents
   * @description render the sidebar filter panel contents
   * @param {boolean} [hideCategories=false] omit the Categories section (used in mobile drawer)
   * @returns {TemplateResult}
   */
  _renderFilterContents(hideCategories=false) {
    return html`
      <!-- Categories (Grants and Works only) -->
      ${!hideCategories && this.browseType === 'grant' ? html`
        <div class="browse-categories">
          <h3>Categories</h3>
          <category-filter-row
            icon="fa-file-invoice-dollar"
            label="All Grants"
            .count="${this._getCategoryTotal()}"
            ?active="${!this.status}"
            @click="${() => this._onStatusChange('')}">
          </category-filter-row>
          <category-filter-row
            icon="fa-hourglass-half"
            label="Active"
            .count="${this._getCategoryCount('status', 'active')}"
            ?active="${this.status === 'active'}"
            @click="${() => this._onStatusChange('active')}">
          </category-filter-row>
          <category-filter-row
            icon="fa-check-circle"
            label="Completed"
            .count="${this._getCategoryCount('status', 'completed')}"
            ?active="${this.status === 'completed'}"
            @click="${() => this._onStatusChange('completed')}">
          </category-filter-row>
        </div>
        <hr class="search-seperator search-seperator--large-dots">
      ` : ''}
      ${!hideCategories && this.browseType === 'work' ? html`
        <div class="browse-categories">
          <h3>Categories</h3>
          <category-filter-row
            icon="fa-book-open"
            label="All Works"
            .count="${this._getCategoryTotal()}"
            ?active="${!this.workType}"
            @click="${() => this._onWorkTypeChange('')}">
          </category-filter-row>
          ${this._getWorkTypeRows()}
        </div>
        <hr class="search-seperator search-seperator--large-dots">
      ` : ''}

      <!-- Affiliation -->
      <div class="collapsible-filter-heading" @click="${() => { this.affiliationCollapsed = !this.affiliationCollapsed; }}">
        <h4>Affiliation</h4>
        <span class="filter-collapse-arrow">
          ${this.affiliationCollapsed
            ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="10" height="16"><path d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>`
            : html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" width="16" height="12"><path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z" fill="var(--ucd-blue-80,#13639E)"/></svg>`
          }
        </span>
      </div>
      ${this.affiliationCollapsed && this.dept?.length ? html`
        <div class="filter-active-summary">
          ${this._getDeptPillGroups(this.dept).map(group => html`
            <span class="filter-active-item" @click="${() => { this.dept = this.dept.filter(c => !group.codes.includes(c)); this._updateLocation(); }}">
              <ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>
              ${group.label}
            </span>
          `)}
        </div>
      ` : ''}
      <div class="affiliation-filter-contents" ?hidden="${this.affiliationCollapsed}">
        <div class="affiliation-search-wrapper">
          <input type="text" class="affiliation-search-input" placeholder="Search Affiliation"
            .value="${this.affiliationSearch}" @input="${this._onAffiliationSearch}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="14" height="14">
            <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/>
          </svg>
        </div>
        <div class="affiliation-checkboxes">
          ${(this.orgLookup || []).map(cat => {
            const matchingSubs = cat.subCategories.map(sub => ({
              ...sub,
              depts: sub.depts.filter(d =>
                !this.affiliationSearch ||
                d.name.toLowerCase().includes(this.affiliationSearch.toLowerCase()) ||
                sub.label.toLowerCase().includes(this.affiliationSearch.toLowerCase())
              )
            })).filter(sub => sub.depts.length);
            if( !matchingSubs.length ) return '';
            return html`
              <div class="affiliation-group-label">${cat.label}</div>
              ${matchingSubs.map(sub => {
                const subCodes = sub.depts.map(d => d.deptCode);
                const checkedCount = subCodes.filter(c => this.dept.includes(c)).length;
                const allChecked = checkedCount === subCodes.length;
                const someChecked = checkedCount > 0 && !allChecked;
                const expanded = this.expandedSubCategories.includes(sub.label);
                return html`
                  <div class="affiliation-sub-row">
                    <input type="checkbox" class="affiliation-sub-checkbox"
                      .indeterminate="${someChecked}" .checked="${allChecked}"
                      @change="${() => this._onSubCategoryCheck(sub.depts)}">
                    <span class="affiliation-toggle" @click="${() => this._toggleSubCategory(sub.label)}">
                      <span class="affiliation-sub-label">${sub.label}</span>
                      <span class="affiliation-sub-caret">
                        ${expanded
                          ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" width="6" height="6"><path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z" fill="var(--ucd-blue-80,#13639E)"/></svg>`
                          : html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="4" height="6"><path d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>`
                        }
                      </span>
                    </span>
                  </div>
                  ${expanded ? html`
                    <div class="affiliation-dept-list">
                      ${sub.depts.map(d => html`
                        <label class="affiliation-dept-row">
                          <input type="checkbox" .value="${d.deptCode}"
                            .checked="${this.dept.includes(d.deptCode)}"
                            @change="${this._onDeptChange}">
                          ${d.name}
                        </label>
                      `)}
                    </div>
                  ` : ''}
                `;
              })}
            `;
          })}
        </div>
      </div>

      <!-- Experts Open To (Experts only) -->
      ${this.browseType === 'expert' ? html`
        <div class="open-to-container">
          <hr class="search-seperator">
          <div class="collapsible-filter-heading" @click="${() => { this.openToCollapsed = !this.openToCollapsed; }}">
            <h4>Experts Open To</h4>
            <span class="filter-collapse-arrow">
              ${this.openToCollapsed
                ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="10" height="16"><path d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>`
                : html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" width="16" height="12"><path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z" fill="var(--ucd-blue-80,#13639E)"/></svg>`
              }
            </span>
          </div>
          <div class="open-to" ?hidden="${this.openToCollapsed}">
            <label><input type="checkbox" id="b-collab-projects" ?checked="${this.collabProjects}" @click="${this._selectCollabProjects}"> Collaborative Projects</label>
            <label><input type="checkbox" id="b-comm-partner" ?checked="${this.commPartner}" @click="${this._selectCommPartner}"> Community Partnerships</label>
            <label><input type="checkbox" id="b-indust-projects" ?checked="${this.industProjects}" @click="${this._selectIndustProjects}"> Industry Projects</label>
            <label><input type="checkbox" id="b-media-interviews" ?checked="${this.mediaInterviews}" @click="${this._selectMediaInterviews}"> Media Interviews</label>
          </div>
          ${this.openToCollapsed ? html`
            <div class="filter-active-summary">
              ${this.collabProjects ? html`<span class="filter-active-item" @click="${() => { this.collabProjects = false; this._updateLocation(); }}"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>Collaborative Projects</span>` : ''}
              ${this.commPartner ? html`<span class="filter-active-item" @click="${() => { this.commPartner = false; this._updateLocation(); }}"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>Community Partnerships</span>` : ''}
              ${this.industProjects ? html`<span class="filter-active-item" @click="${() => { this.industProjects = false; this._updateLocation(); }}"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>Industry Projects</span>` : ''}
              ${this.mediaInterviews ? html`<span class="filter-active-item" @click="${() => { this.mediaInterviews = false; this._updateLocation(); }}"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>Media Interviews</span>` : ''}
            </div>
          ` : ''}
        </div>
      ` : ''}
      ${this.browseType === 'work' || this.browseType === 'grant' ? html`
        <!-- Date filter -->
        <div class="range-filter-container">
          <hr class="search-seperator">
          <div class="collapsible-filter-heading" @click="${() => { this.dateCollapsed = !this.dateCollapsed; if( !this.dateCollapsed ) this._refreshRange(false); }}">
            <h4>Date</h4>
            <span class="filter-collapse-arrow">
              ${this.dateCollapsed
                ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="10" height="16"><path d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>`
                : html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" width="16" height="12"><path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z" fill="var(--ucd-blue-80,#13639E)"/></svg>`
              }
            </span>
          </div>
          ${this.dateCollapsed && this.filterByDate ? html`
            <div class="filter-active-summary">
              <span class="filter-active-item" @click="${this._removeDateFilter}">
                <ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>${this.filterByDateLabel}
              </span>
            </div>
          ` : ''}
          <div ?hidden="${this.dateCollapsed}">
            ${this.browseType === 'grant' ? html`<span class="date-filter-hint" ?hidden="${this.dateRangeData.length < 2}">Grants are shown across their active years.</span>` : ''}
            ${this.browseType === 'expert' || this.browseType === '' ? html`<span class="date-filter-hint" ?hidden="${this.dateRangeData.length < 2}">Based on associated works and grants; grants are shown across their active years.</span>` : ''}          
            <div class="search-year" ?hidden="${this.dateRangeData.length !== 1}">${this.dateRangeData[0]?.stat}</div>
            <div class="slider-container" ?hidden="${this.dateRangeData.length < 2}">
              <ucdlib-range-slider
                @range-slider-change="${this._onRangeSliderChange}"
                .data="${this.dateRangeData}"
                .showUnknown="${true}">
              </ucdlib-range-slider>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }

  /**
   * @method _onStatusChange
   * @description handle grant status category filter changes
   * @param {String} newStatus new status value, or '' to clear
   */
  _onStatusChange(newStatus) {
    // clicking the already-active filter (or "All") clears the filter
    if( !newStatus || this.status === newStatus ) {
      this.status = '';
    } else {
      this.status = newStatus;
    }
    this.currentPage = 1;
    this._updateLocation();
  }

  /**
   * @method _onWorkTypeChange
   * @description handle work type category filter changes
   * @param {String} newType new work type value, or '' to clear
   */
  _onWorkTypeChange(newType) {
    if( !newType || this.workType === newType ) {
      this.workType = '';
    } else {
      this.workType = newType;
    }
    this.currentPage = 1;
    this._updateLocation();
  }

  /**
   * @method _toggleRefineSearch
   * @description toggle the refine search (mobile filter) drawer
   */
  _toggleRefineSearch() {
    this.refineSearchCollapsed = !this.refineSearchCollapsed;
    if( this.refineSearchCollapsed ) {
      this.mobileCategoryOpen = false;
    }
    if( !this.refineSearchCollapsed ) this._refreshRange();
  }

  /**
   * @method _onRangeSliderChange
   * @description handle range slider change events
   * @param {Object} e custom event with detail.min and detail.max
   */
  _onRangeSliderChange(e) {
    this.filterByDate = true;
    this.currentPage = 1;
    this.dateFrom = e.detail.min;
    this.dateTo = e.detail.max;
    this.filterByDateLabel = e.detail.min + ' - ' + e.detail.max;
    this._updateLocation();
  }

  /**
   * @method _removeDateFilter
   * @description remove the active date range filter
   */
  _removeDateFilter() {
    this.filterByDate = false;
    this.filterByDateLabel = '';
    this.dateFrom = '';
    this.dateTo = '';
    this._updateLocation();
    const ranges = this.shadowRoot.querySelectorAll('ucdlib-range-slider');
    for( const range of ranges ) range.reset();
  }

  /**
   * @method _selectCollabProjects
   * @description bound to change events of the collab projects checkbox
   * @param {Object} e change event
   */
  _selectCollabProjects(e) {
    this.collabProjects = e.target.checked;
    this._updateLocation();
  }

  /**
   * @method _selectCommPartner
   * @description bound to change events of the community partnerships checkbox
   * @param {Object} e change event
   */
  _selectCommPartner(e) {
    this.commPartner = e.target.checked;
    this._updateLocation();
  }

  /**
   * @method _selectIndustProjects
   * @description bound to change events of the industry projects checkbox
   * @param {Object} e change event
   */
  _selectIndustProjects(e) {
    this.industProjects = e.target.checked;
    this._updateLocation();
  }

  /**
   * @method _selectMediaInterviews
   * @description bound to change events of the media interviews checkbox
   * @param {Object} e change event
   */
  _selectMediaInterviews(e) {
    this.mediaInterviews = e.target.checked;
    this._updateLocation();
  }

  /**
   * @method _clearAllFilters
   * @description clear all active filters and reset the URL
   */
  _clearAllFilters() {
    this.dept = [];
    this.status = '';
    this.workType = '';
    this.collabProjects = false;
    this.commPartner = false;
    this.industProjects = false;
    this.mediaInterviews = false;
    this.filterByDate = false;
    this.filterByDateLabel = '';
    this.dateFrom = '';
    this.dateTo = '';

    const setChecked = (id, val) => {
      this.shadowRoot.querySelectorAll(`#${id}, #m-${id}`).forEach(el => { el.checked = val; });
    };
    setChecked('b-collab-projects', false);
    setChecked('b-comm-partner', false);
    setChecked('b-indust-projects', false);
    setChecked('b-media-interviews', false);

    this._updateLocation();
  }

  /**
   * @method _getActiveFilterCount
   * @description count the number of active filters for the filter badge
   * @returns {Number}
   */
  _getActiveFilterCount() {
    let count = 0;
    if( this.dept?.length ) count += this._getDeptPillGroups(this.dept).length;
    if( this.filterByDate ) count++;
    if( this.collabProjects ) count++;
    if( this.commPartner ) count++;
    if( this.industProjects ) count++;
    if( this.mediaInterviews ) count++;
    return count;
  }

  /**
   * @method _getCategoryCount
   * @description return formatted count for a category aggregation bucket
   * @param {String} key aggregation field name
   * @param {String} value bucket value
   * @returns {String} formatted count or empty string
   */
  _getCategoryCount(key, value) {
    if( !this.categoryAggregations ) return '';
    const agg = this.categoryAggregations[key];
    if( !agg || typeof agg !== 'object' ) return '';
    const count = agg[value];
    return typeof count === 'number' ? count.toLocaleString() : '0';
  }

  /**
   * @method _getCategoryTotal
   * @description return formatted total count across all category buckets
   * @returns {String} formatted total or empty string
   */
  _getCategoryTotal() {
    const agg = this.browseType === 'grant'
      ? this.categoryAggregations?.status
      : this.categoryAggregations?.type;
    if( !agg || typeof agg !== 'object' ) return '';
    const total = Object.values(agg).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
    return total.toLocaleString();
  }

  /**
   * @method _getWorkTypeRows
   * @description render work-type category rows for the sidebar filter
   * @returns {Array} array of TemplateResults
   */
  _getWorkTypeRows() {
    const typeAgg = this.categoryAggregations?.type;
    if( !typeAgg || typeof typeAgg !== 'object' || !Object.keys(typeAgg).length ) {
      return DEFAULT_WORK_TYPES.map(t => html`
        <category-filter-row
          icon="fa-book-open"
          label="${t.label}"
          .count="${0}"
          ?active="${this.workType === t.key}"
          @click="${() => this._onWorkTypeChange(t.key)}">
        </category-filter-row>
      `);
    }
    return Object.entries(typeAgg)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => utils.getCitationType(a.key).localeCompare(utils.getCitationType(b.key)))
      .map(({ key, count }) => html`
        <category-filter-row
          icon="fa-book-open"
          label="${utils.getCitationType(key)}"
          .count="${count}"
          ?active="${this.workType === key}"
          @click="${() => this._onWorkTypeChange(key)}">
        </category-filter-row>
      `);
  }

  /**
   * @method _getWorkTypeLabel
   * @description return display label for a work type key
   * @param {String} key work type key
   * @returns {String}
   */
  _getWorkTypeLabel(key) {
    return utils.getCitationType(key) || key;
  }

  /**
   * @method _getWorkTypeItems
   * @description render work-type dropdown items for the mobile filter
   * @returns {Array} array of TemplateResults
   */
  _getWorkTypeItems() {
    const typeAgg = this.categoryAggregations?.type;
    if( !typeAgg || typeof typeAgg !== 'object' || !Object.keys(typeAgg).length ) {
      return DEFAULT_WORK_TYPES.map(t => html`<button class="category-dropdown-item ${this.workType === t.key ? 'active' : ''}" @click="${() => this._onMobileCategoryChange(t.key)}">${t.label}</button>`);
    }
    return Object.entries(typeAgg)
      .map(([key]) => ({ key, label: utils.getCitationType(key) }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(({ key, label }) => html`<button class="category-dropdown-item ${this.workType === key ? 'active' : ''}" @click="${() => this._onMobileCategoryChange(key)}">${label}</button>`);
  }

  /**
   * @method _getWorkTypeOptions
   * @description render work-type <option> elements for the mobile select
   * @returns {Array} array of TemplateResults
   */
  _getWorkTypeOptions() {
    const typeAgg = this.categoryAggregations?.type;
    if( !typeAgg || typeof typeAgg !== 'object' || !Object.keys(typeAgg).length ) {
      return DEFAULT_WORK_TYPES.map(t => html`<option value="${t.key}" ?selected="${this.workType === t.key}">${t.label}</option>`);
    }
    return Object.entries(typeAgg)
      .map(([key]) => ({ key, label: utils.getCitationType(key) }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(({ key, label }) => html`<option value="${key}" ?selected="${this.workType === key}">${label}</option>`);
  }

  /**
   * @method _getMobileViewLabel
   * @description return the label for the mobile "View N results" button
   * @returns {String}
   */
  _getMobileViewLabel() {
    const n = this.totalResultsCount != null ? this.totalResultsCount : '';
    if( this.browseType === 'expert' ) return `View ${n} expert${n === 1 ? '' : 's'}`;
    if( this.browseType === 'grant' ) {
      let label = this.status ? this.status.toLowerCase() + ' grant' : 'grant';
      if( n !== 1 ) label += 's';
      return `View ${n} ${label}`;
    }
    if( this.browseType === 'work' ) {
      if( this.workType ) {
        const label = utils.getCitationType(this.workType).toLowerCase();
        return `View ${n} ${label}${n === 1 ? '' : 's'}`;
      }
      return `View ${n} work${n === 1 ? '' : 's'}`;
    }
    return `View ${n} results`;
  }

  /**
   * @method _getMobileCategoryLabel
   * @description return the label for the mobile category dropdown trigger
   * @returns {String}
   */
  _getMobileCategoryLabel() {
    if( this.browseType === 'grant' ) {
      if( this.status === 'active' ) return 'Active';
      if( this.status === 'completed' ) return 'Completed';
      return 'All Grants';
    }
    if( this.browseType === 'work' ) {
      if( this.workType ) return utils.getCitationType(this.workType);
      return 'All Works';
    }
    return '';
  }

  /**
   * @method _onMobileCategoryChange
   * @description handle mobile category dropdown selection
   * @param {String} val selected category value
   */
  _onMobileCategoryChange(val) {
    this.mobileCategoryOpen = false;
    if( this.browseType === 'grant' ) this._onStatusChange(val);
    else if( this.browseType === 'work' ) this._onWorkTypeChange(val);
  }

}

customElements.define('app-browse-by', AppBrowseBy);
