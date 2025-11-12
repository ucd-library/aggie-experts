import { LitElement } from 'lit';
import {render} from "./app-search.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import JSZip from 'jszip';
import FileSaver from 'file-saver';

import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";

import "../../components/search-box";
import "../../components/search-result-row";
import "../../components/category-filter-controller.js";

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
      atType : { type : String },
      status : { type : String },
      type : { type : String },
      showOpenTo : { type : Boolean },
      rangeFilterTypes : { type : String },
      filterByExpert : { type : Boolean },
      filterByExpertId : { type : String },
      filterByExpertName : { type : String },
      filterByDate : { type : Boolean },
      filterByDateLabel : { type : String },
      globalAggregations : { type : Object },
      resultsSelected : { type : Boolean },
      allResultsSelected : { type : Boolean },
      dateFrom : { type : String },
      dateTo : { type : String },
      dateRangeData : { type : Array },
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
    this.atType = '';
    this.status = '';
    this.type = '';
    this.showOpenTo = false;
    this.rangeFilterTypes = 'Works, Grants';
    this.filterByExpert = false;
    this.filterByExpertId = '';
    this.filterByExpertName = '';
    this.filterByDate = false;
    this.filterByDateLabel = '';
    this.globalAggregations = {};
    this.filteringByGrants = false;
    this.filteringByWorks = false;
    this.resultsSelected = false;
    this.allResultsSelected = false;
    this.downloads = [];
    this.dateFrom = '';
    this.dateTo = '';
    this.dateRangeData = [];

    this.render = render.bind(this);
  }

  connectedCallback() {
    super.connectedCallback && super.connectedCallback();
    this._boundWindowResize = this._onWindowResize.bind(this);
    window.addEventListener('resize', this._boundWindowResize, { passive: true });
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this._boundWindowResize);
    super.disconnectedCallback && super.disconnectedCallback();
  }

  async _onWindowResize() {
    this._refreshRange();
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

  async _refreshRange() {
    const ranges = this.shadowRoot?.querySelectorAll('ucdlib-range-slider');
    for( const range of ranges ) {
      // Force a full histogram rebuild similar to a resize-triggered refresh.
      try {
        // Many versions of ucdlib-range-slider compute bins on first render or on resize.
        // Reset the internal render guard (if present) to ensure recalculation.
        if ('hasRendered' in range) range.hasRendered = false;

        // Request a refresh of the component and wait for DOM to settle
        range.requestUpdate?.();
        await (range.updateComplete?.catch(() => {}));

        // Trigger internal resize handler if available (matches user-observed behavior on window resize)
        if (typeof range._onResize === 'function') {
          range._onResize();
        } else {
          // Fallback: broadcast a window resize event to nudge any internal listeners
          try { window.dispatchEvent(new Event('resize')); } catch (_) {}
        }

        // Defer histogram update to the next frame so layout/width are final
        requestAnimationFrame(() => {
          try {
            if (typeof range._updateHistogram === 'function') {
              range._updateHistogram();
            }
          } catch (e) {
            console.warn('range slider histogram update error', e);
          }
        });
      } catch (err) {
        console.warn('range slider refresh error', err);
      }
    }
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

      if( query['@type'] ) this.atType = query['@type'];

      if( query.expert ) {
        this.filterByExpert = true;
        this.filterByExpertId = query.expert;
      } else {
        this.filterByExpert = false;
        this.filterByExpertId = '';
        this.filterByExpertName = '';
      }

      this.status = query.status || '';
      this.type = query.type || '';

      this.collabProjects = query.availability?.includes('collab') ? true : false;
      this.commPartner = query.availability?.includes('community') ? true : false;
      this.industProjects = query.availability?.includes('industry') ? true : false;
      this.mediaInterviews = query.availability?.includes('media') ? true : false;

      this.dateFrom = query.dateFrom || '';
      this.dateTo = query.dateTo || '';
      if( this.dateFrom || this.dateTo ) {
        this.filterByDate = true;
        this.filterByDateLabel = (this.dateFrom || '') + ' - ' + (this.dateTo || '');
        requestAnimationFrame(() => this._refreshRange());
      }

      let page = this.AppStateModel.location?.path?.[1];
      if( page ) this.currentPage = page;

      this.resultsPerPage = parseInt(this.AppStateModel.location?.path?.[2] || 25);
    } else {
      // no query params, so clear filters
      this.atType = '';
      this.status = '';
      this.type = '';
      this.filterByExpert = false;
      this.filterByExpertId = '';
      this.filterByExpertName = '';
      this.commPartner = false;
      this.collabProjects = false;
      this.industProjects = false;
      this.mediaInterviews = false;
      this.dateFrom = '';
      this.dateTo = '';
      this.filterByDate = false;
      this.filterByDateLabel = '';

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
    this.showOpenTo = this.atType === 'expert';
    this.rangeFilterTypes = 'Works, Grants';
    if( this.atType === 'work' ) this.rangeFilterTypes = 'Works';
    else if( this.atType === 'grant' ) this.rangeFilterTypes = 'Grants';
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
    console.log('todo need to keep the date filtering in place when filtering by expert grants');

    // filter by grants for this expert
    this.filterByExpertId = e.detail.id;
    this.filterByExpertName = e.detail.name;
    this.filteringByGrants = true;
    this.filteringByWorks = false;
    this.currentPage = 1;
    this.downloads = [];
    this.paginationChange = false;

    if( this.filterByExpertId && this.filterByExpertName ) {
      this.filterByExpert = true;
      this.addingFilter = true;
      this.AppStateModel.set({ resetSearch : false });
      this._updateLocation();
    }

    this.dispatchEvent(
      new CustomEvent("reset-scroll", {
        bubbles : true,
        cancelable : true,
      })
    );
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
    this.currentPage = 1;
    this.downloads = [];
    this.paginationChange = false;

    if( this.filterByExpertId && this.filterByExpertName ) {
      this.filterByExpert = true;
      this.addingFilter = true;
      this.AppStateModel.set({ resetSearch : false });
      this._updateLocation();
    }

    this.dispatchEvent(
      new CustomEvent("reset-scroll", {
        bubbles : true,
        cancelable : true,
      })
    );
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
    // this._refreshRange();
  }

  /**
   * @method _removeDateFilter
   * @description remove the date filter
   */
  _removeDateFilter(e) {
    this.filterByDate = false;
    this.filterByDateLabel = '';
    this.dateFrom = '';
    this.dateTo = '';
    this._updateLocation();

    let ranges = this.shadowRoot.querySelectorAll('ucdlib-range-slider');
    for( const range of ranges ) {
      range.reset();
    }

    this._refreshRange();
  }

  /**
   * @method _onRangeSliderChange
   * @description handle range slider change events
   * @param {Object} e
   */
  _onRangeSliderChange(e) {
    this.filterByDate = true;
    this.dateFrom = e.detail.min;
    this.dateTo = e.detail.max;
    this.filterByDateLabel = e.detail.min + ' - ' + e.detail.max;
    this._updateLocation();
  }

  /**
   * @method _computeAggSignature
   * @description compute the aggregation signature for the current search state
   * @returns {String} JSON string of the aggregation signature
   */
  _computeAggSignature() {
    const q = this.searchTerm || '';
    const availability = {
      collab: this.collabProjects,
      community: this.commPartner,
      industry: this.industProjects,
      media: this.mediaInterviews
    };
    return JSON.stringify({
      q,
      availability,
      atType: this.atType || '',
      status: this.status || '',
      type: this.type || '',
      expert: this.filterByExpert ? this.filterByExpertId : ''
    });
  }

  /**
   * @method _buildHistogramDataFromAgg
   * @description build histogram data from the aggregation results
   * @param {Object} issuedYearsObj
   */
  _buildHistogramDataFromAgg(issuedYearsObj = {}) {
    // keys are epoch ms; convert to year ints
    const entries = Object.entries(issuedYearsObj)
      .map(([k, v]) => [new Date(Number(k)).getUTCFullYear(), v])
      .sort((a, b) => a[0] - b[0]);

    if (!entries.length) return [];

    const minY = entries[0][0];
    const maxY = entries[entries.length - 1][0];
    const map = new Map(entries); // year -> count

    const data = [];
    for (let y = minY; y <= maxY; y++) {
      data.push({ stat: y, value: map.get(y) || 0 });
    }
    return data;
  }

  _toggleRefineSearch() {
    this.refineSearchCollapsed = !this.refineSearchCollapsed;    
    if( !this.refineSearchCollapsed ) this._refreshRange();
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

    let searchWords = utils.filterOutStopWords(this.searchTerm);
    if( !searchWords.length ) {
      this.currentPage = 1;
      this.downloads = [];
      this._updateLocation();
      this.totalResultsCount = 0;
      this.displayedResults = [];
      this.globalAggregations = { reset : true };
      this.paginationTotal = 1;
      return;
    }

    let availability = utils.buildSearchAvailability({
      collabProjects : this.collabProjects,
      commPartner : this.commPartner,
      industProjects : this.industProjects,
      mediaInterviews : this.mediaInterviews
    });

    if( resetPage ) {
      this.currentPage = 1;
      this.downloads = [];
      this.paginationChange = false;

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
          this.AppStateModel.location.query['@type'],
          this.AppStateModel.location.query.status,
          this.AppStateModel.location.query.type,
          this.filterByExpertId,
          this.dateFrom,
          this.dateTo
        )
      ),
      true
    );

    // Histogram refresh is handled in _onSearchUpdate after data/min/max are applied.
  }

  /**
   * @method _updateLocation
   * @description update the url with the current search filters/search term
   */
  _updateLocation() {
    if( this.addingFilter && this.filterByExpert ) {
      if( this.filteringByGrants ) this.atType = 'grant';
      if( this.filteringByWorks ) this.atType = 'work';
      this.addingFilter = false;
    }

    // url should be /search/<searchTerm> if no search filters, otherwise /search?=<searchTerm>&availability=collab,community,industry,media etc
    let availability = [];
    if( this.collabProjects ) availability.push('collab');
    if( this.commPartner ) availability.push('community');
    if( this.industProjects ) availability.push('industry');
    if( this.mediaInterviews ) availability.push('media');

    let hasQueryParams = availability.length || this.atType.length || this.filterByExpert || this.status.length || this.dateFrom || this.dateTo;

    let path = hasQueryParams ? '/search' : `/search/${encodeURIComponent(this.searchTerm)}`;
    if( this.currentPage > 1 || this.resultsPerPage > 25 ) path += `/${this.currentPage}`;
    if( this.resultsPerPage > 25 ) path += `/${this.resultsPerPage}`;

    if( hasQueryParams ) path += `?q=${encodeURIComponent(this.searchTerm)}`;
    if( availability.length ) path += `&availability=${availability.join(',')}`;
    if( this.atType.length ) path += `&@type=${this.atType}`;
    if( this.status.length ) path += `&status=${this.status}`;
    if( this.type.length ) path += `&type=${this.type}`;
    if( this.filterByExpert ) path += `&expert=${this.filterByExpertId}`;
    if( this.dateFrom ) path += `&dateFrom=${this.dateFrom}`;
    if( this.dateTo ) path += `&dateTo=${this.dateTo}`;

    this.AppStateModel.setLocation(path);
  }

  async _onSearchUpdate(e, fromSearchPage=false) {
    if (e?.state !== 'loaded' || !fromSearchPage) return;

    if (this.filterByExpert && this.filterByExpertId && !this.filterByExpertName) {
      this.filterByExpertName = await this._getExpertNameById(this.filterByExpertId);
    }

    this.rawSearchData = JSON.parse(JSON.stringify(e.payload));
    this.globalAggregations = this.rawSearchData['global_aggregations'] || {};

    // histogram/slider: refresh ONLY when the “agg signature” changes (q, availability, type, status, expert)
    const newSig = this._computeAggSignature(); // this must NOT include dateFrom/dateTo
    if (newSig !== this.lastAggSignature) {
      const issuedYearsCombined = (this.globalAggregations || {})['issued_years_combined'] || {};
      const issuedYearsWorks = (this.globalAggregations || {})['issued_years_works'] || {};
      const issuedYearsGrants = (this.globalAggregations || {})['issued_years_grants'] || {};
      const issueYearsWorksSubfilter = (this.globalAggregations || {})[`issued_years_type_${this.type}`] || {};
      const issueYearsGrantsSubfilter = (this.globalAggregations || {})[`issued_years_status_${this.status}`] || {};

      // if filtering All Results, use combined; if filtering by Works or Grants, use those specific aggs
      let issuedYears = issuedYearsCombined;
      if( this.atType === 'work' ) {
        if( this.type ) issuedYears = issueYearsWorksSubfilter;
        else issuedYears = issuedYearsWorks;
      } else if( this.atType === 'grant' ) {
        if( this.status ) issuedYears = issueYearsGrantsSubfilter;
        else issuedYears = issuedYearsGrants;
      }

      this.dateRangeData = this._buildHistogramDataFromAgg(JSON.parse(JSON.stringify(issuedYears))); // [{stat: YYYY, value: count}, ...]

      const ranges = this.shadowRoot.querySelectorAll('ucdlib-range-slider');
      for (const range of ranges) {
        if (range && Array.isArray(this.dateRangeData) && this.dateRangeData.length) {
          // Feed histogram data (component derives absMin/absMax from data)
          range.data = this.dateRangeData;
          range.hideHistogram = false;

          // Initial selection: honor URL params if present, else full range
          const absMin = this.dateRangeData[0].stat;
          const absMax = this.dateRangeData[this.dateRangeData.length - 1].stat;

          const urlMin = this.dateFrom ? Number(this.dateFrom) : null;
          const urlMax = this.dateTo ? Number(this.dateTo) : null;

          const clampedMin = urlMin != null ? Math.max(absMin, Math.min(urlMin, absMax)) : absMin;
          const clampedMax = urlMax != null ? Math.max(absMin, Math.min(urlMax, absMax)) : absMax;

          // Optional: update chip label if a date filter is active
          if (this.filterByDate && (this.dateFrom || this.dateTo)) {
            this.filterByDateLabel = `${clampedMin} - ${clampedMax}`;
          }

          // Update slider values and re-render
          await this._refreshRange();
          range.min = clampedMin;
          range.max = clampedMax;
        }
      }

      this.lastAggSignature = newSig;
    }

    // results list mapping
    this.displayedResults = (e.payload?.hits || []).map((r, index) => {
      let resultType = '';
      if (r['@type'] === 'Grant' || r['@type']?.includes?.('Grant')) resultType = 'grant';
      if (r['@type'] === 'Expert' || r['@type']?.includes?.('Expert')) resultType = 'expert';
      if (r['@type'] === 'Work' || r['@type']?.includes?.('Work')) resultType = 'work';

      let id = r['@id'];
      if (Array.isArray(r.name)) r.name = r.name[0];
      let name = r.name?.split('§')?.shift()?.trim();

      let subtitle, numberOfWorks, numberOfGrants;

      if (resultType === 'expert') {
        subtitle = r.name?.split('§')?.pop()?.trim();
        if (name === subtitle) subtitle = '';
        numberOfWorks = (r['_inner_hits']?.filter(h => h['@type']?.includes('Work')) || []).length;
        numberOfGrants = (r['_inner_hits']?.filter(h => h['@type']?.includes('Grant')) || []).length;

      } else if (resultType === 'grant') {
        subtitle = ((r.name?.split('§') || [])[1] || '').trim();
        let [status, dateRange, pi] = subtitle.split('•');
        subtitle = 'Grant';
        if (status)    subtitle += ' <span class="dot-separator">•</span> ' + status.trim();
        if (dateRange) subtitle += ' <span class="dot-separator">•</span> ' + dateRange.trim();
        if (pi)        subtitle += ' <span class="dot-separator">•</span> PI: ' + pi.trim();
        id = 'grant/' + id;

      } else if (resultType === 'work') {
        subtitle = '';
        const subtitleParts = ((r.name?.split('§') || [])[1] || '')?.split('•')?.slice?.(1) || [];
        if (subtitleParts.length) {
          const type = subtitleParts[0]?.trim() || '';
          if (type) subtitle += utils.getCitationType(type) + ' <span class="dot-separator">•</span> ';
          const date = subtitleParts[1]?.trim() || '';
          if (date) {
            const [year] = date.split?.('-');
            subtitle += utils.formatDate({ year }) + ' <span class="dot-separator">•</span> ';
          }
          const authors = subtitleParts[2]?.trim() || '';
          if (authors) subtitle += authors;
        }
        id = 'work/' + id;
      }

      return {
        resultType,
        position: index + 1,
        id,
        name,
        subtitle,
        numberOfWorks,
        numberOfGrants,
        graph: r
      };
    });

    this.totalResultsCount = e.payload.total;
    this.paginationTotal = Math.ceil(this.totalResultsCount / this.resultsPerPage);

    this.requestUpdate();
    requestAnimationFrame(() => this._clearSelectedSearchResults());
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
   * @method _selectResult
   * @description bound to click events of search result checkboxes
   *
   * @param {Object} e click|keyup event
   */
  _selectResult(e) {
    let id = e.detail.id;
    let match = this.displayedResults.find(r => r.id === e.detail.id);
    if( !match ) return;

    if( e.detail.selected ) {
      if( !this.downloads.find(r => r.id === id) ) this.downloads.push(match);
    } else {
      this.downloads = this.downloads.filter(d => d.id !== id);
    }

    this._checkResultsSelected();
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
      let id = checkbox.dataset.id;
      let match = this.displayedResults.find(r => r.id === id);

      if( match && checkbox.checked ) {
        if( !this.downloads.find(r => r.id === id) ) this.downloads.push(match);
      } else {
        this.downloads = this.downloads.filter(d => d.id !== id);
      }
    });

    this._checkResultsSelected();
  }

  /**
   * @method _checkResultsSelected
   * @description check if any results are selected, disable download button if not
   */
  _checkResultsSelected() {
    let checkboxes = [];
    let resultRows = (this.shadowRoot.querySelectorAll('app-search-result-row') || []);
    resultRows.forEach(row => {
      checkboxes.push(...row.shadowRoot.querySelectorAll('input[type="checkbox"]') || []);
    });

    this.resultsSelected = this.downloads.length > 0;
    this.allResultsSelected = checkboxes.every(checkbox => checkbox.checked);
  }

  /**
   * @method _clearSelectedSearchResults
   * @description clear selected search results
   */
  _clearSelectedSearchResults() {
    let checkboxes = [];
    let resultRows = (this.shadowRoot.querySelectorAll('app-search-result-row') || []);
    resultRows.forEach(row => {
      checkboxes.push(...row.shadowRoot.querySelectorAll('input[type="checkbox"]') || []);
    });

    checkboxes.forEach(checkbox => {
      if( this.paginationChange && this.downloads.find(d => d.id === checkbox.dataset.id) ) checkbox.checked = true;
      else checkbox.checked = false;
    });

    this.resultsSelected = this.downloads.length !== 0;
    this.allResultsSelected = false; // allSelectedOnPage;
  }

  /**
   * @method _onPaginationChange
   * @description bound to click events of the pagination element
   *
   * @param {Object} e click|keyup event
   */
  async _onPaginationChange(e) {
    this.paginationChange = true;
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
          this.AppStateModel.location.query['@type'],
          this.AppStateModel.location.query.status,
          this.AppStateModel.location.query.type,
          this.filterByExpertId,
          this.dateFrom,
          this.dateTo
        )
      ),
      true
    );

    this.dispatchEvent(
      new CustomEvent("reset-scroll", {
        bubbles : true,
        cancelable : true,
      })
    );
  }

  /**
   * @method _selectCollabProjects
   * @description bound to change events of the collab projects checkbox
   * @param {Object} e change event
   */
  _selectCollabProjects(e) {
    this.collabProjects = e.currentTarget.checked;
    this.currentPage = 1;
    this.downloads = [];
    this.paginationChange = false;
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
    this.downloads = [];
    this.paginationChange = false;
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
    this.downloads = [];
    this.paginationChange = false;
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
    this.downloads = [];
    this.paginationChange = false;
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

    let works = [], grants = [], experts = [];
    let numFiles = 0;

    (this.downloads || []).forEach(download => {
      let resultType = download.resultType;
      let match = download.graph;
      if( !match ) return;

      if( resultType === 'expert' ) {
        // experts.csv:
        // Name | Aggie Experts Webpage | # of works that match the keyword | Number of grants that match the keyword | URLs from the profile
        let name = match.name?.split('§')?.[0]?.trim();
        let landingPage = 'https://experts.ucdavis.edu/' + match['@id'];
        let numberOfWorks = (match['_inner_hits']?.filter(h => h['@type']?.includes('Work')) || []).length;
        let numberOfGrants = (match['_inner_hits']?.filter(h => h['@type']?.includes('Grant')) || []).length;
        let urls = (match.contactInfo?.hasURL || []).map(w => w.url.trim()).join('; ');

        experts.push(
          '"' + name + '",' +
          '"' + landingPage + '",' +
          '"' + numberOfWorks + '",' +
          '"' + numberOfGrants + '",' +
          '"' + urls + '",'
        );

      } else if( resultType === 'grant' ) {
        // grants.csv:
        // Title | Funding Agency | Grant id {the one given by the agency, not ours} | Start date | End date | Type of Grant | List of PIs and coPIs {separate contributors by ";"} | Other Known Contributors {separate contributors by ";"}
        let title = match.name.split('§')[0]?.trim() || '';
        let fundingAgency = match.assignedBy?.name || '';
        let grantId = match.sponsorAwardId || '';
        let startDate = match.dateTimeInterval?.start?.dateTime || '';
        let endDate = match.dateTimeInterval?.end?.dateTime || '';

        // determine type(s) from all types excluding 'Grant', and split everything after 'Grant_' by uppercase letters with space
        // should just be one type, but just in case
        try {
          if( match['@type'] && !Array.isArray(match['@type']) ) match['@type'] = [match['@type']];
          match.types = (match['@type'] || []).filter(t => t !== 'Grant').map(t => t.split('Grant_')[1].replace(/([A-Z])/g, ' $1').trim());
        } catch(e) {
          match.types = ['Grant'];
        }
        let typeOfGrant = match.types.join(', ') || '';

        let contributors = match.relatedBy || [];
        if( !Array.isArray(contributors) ) contributors = [contributors];

        let pisCoPis = ''; // List of PIs and coPIs {separate contributors by ";"}
        let otherContributors = ''; // Other Known Contributors {separate contributors by ";"}

        contributors.forEach(c => {
          let role = utils.getGrantRole(c)?.role || '';
          let name = c.name || '';
          if( Array.isArray(name) ) name = name[0];
          name = name.replace(/\s*CoPI:\s*/gi, '');
          name = name.replace(/\s*PI:\s*/gi, '');
          if( role === 'Principal Investigator' || role === 'Co-Principal Investigator' ) {
            pisCoPis += name + '; ';
          } else {
            otherContributors += name + '; ';
          }
        });

        grants.push(
          '"' + title + '",' +
          '"' + fundingAgency + '",' +
          '"' + grantId + '",' +
          '"' + startDate + '",' +
          '"' + endDate + '",' +
          '"' + typeOfGrant + '",' +
          '"' + pisCoPis + '",' +
          '"' + otherContributors + '",'
        );
      } else if( resultType === 'work' ) {
        // works.csv:
        // Type of Work | Title | Authors {separate contributors by ";"; if more than 10 contributors, use et.a;.)| Year | Journal OR Book | Volume | Issue | Pages | DOI or URL | Abstract
        let workType = utils.getCitationType(match.type) || '';
        let title = match.title || '';

        // {separate contributors by ";"; if more than 10 contributors, use et.a;.)
        let authors;
        if( match.author && match.author.length > 10 ) {
          let subtitleParts = ((match.name?.split('§') || [])[1] || '')?.split('•')?.slice?.(1) || [];
          authors = subtitleParts?.[2]?.trim() || '';
        } else {
          authors = (match.author || []).map(a => a.family + ', ' + a.given).join('; ');
        }

        if( Array.isArray(match.issued) ) match.issued = match.issued[0];
        let [ year, month, day ] = match.issued?.split?.('-');
        let yearFormatted = utils.formatDate({ year });
        if( Array.isArray(match['container-title']) ) match['container-title'] = match['container-title'][0];
        let journalBook = match['container-title'] || '';
        let volume = match.volume || '';
        let issue = match.issue || '';
        let page = match.page || '';
        let publisherLink = match.DOI ? `https://doi.org/${match.DOI}` : '';
        let abstract = match.abstract || '';

        works.push(
          '"' + workType + '",' +
          '"' + title + '",' +
          '"' + authors + '",' +
          '"' + yearFormatted + '",' +
          '"' + journalBook + '",' +
          '"' + volume + '",' +
          '"' + issue + '",' +
          '"' + page + '",' +
          '"' + publisherLink + '",' +
          '"' + abstract + '",'
        );
      }
    });

    if( !works.length && !grants.length && !experts.length ) return;

    // if 2+ types of files are needed, generate zip. otherwise single csv
    if( works.length ) numFiles++;
    if( grants.length ) numFiles++;
    if( experts.length ) numFiles++;
    if( numFiles > 1 ) {
      let zip = new JSZip();

      if( works.length ) {
        works.unshift('Type of Work,Title,Authors,Year,Journal/Book,Volume,Issue,Pages,DOI/URL,Abstract');
        zip.file("works.csv", works.join('\n'));
      }

      if( grants.length ) {
        grants.unshift('Title,Funding Agency,Grant ID,Start Date,End Date,Type of Grant,PIs and coPIs,Other Known Contributors');
        zip.file("grants.csv", grants.join('\n'));
      }

      if( experts.length ) {
        experts.unshift('Name,Aggie Experts Webpage,Number of works that match the keyword,Number of grants that match the keyword,URLs from the profile');
        zip.file("experts.csv", experts.join('\n'));
      }

      zip
        .generateAsync({type:"blob"})
        .then((content, filename=`search_${this.searchTerm.split(' ').join('_').substring(0, 50)}.zip`) => {
          FileSaver.saveAs(content, filename);
      });
    } else {
      let blob, filename;
      if( works.length ) {
        works.unshift('Type of Work,Title,Authors,Year,Journal/Book,Volume,Issue,Pages,DOI/URL,Abstract');
        blob = new Blob(works.map(w => w + '\n'), { type: 'text/csv;charset=utf-8;' });
        filename = 'works.csv';
      }

      if( grants.length ) {
        grants.unshift('Title,Funding Agency,Grant ID,Start Date,End Date,Type of Grant,PIs and coPIs,Other Known Contributors');
        blob = new Blob(grants.map(g => g + '\n'), { type: 'text/csv;charset=utf-8;' });
        filename = 'grants.csv';
      }

      if( experts.length ) {
        experts.unshift('Name,Aggie Experts Webpage,Number of works that match the keyword,Number of grants that match the keyword,URLs from the profile');
        blob = new Blob(experts.map(e => e + '\n'), { type: 'text/csv;charset=utf-8;' });
        filename = 'experts.csv';
      }

      let url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  _onFilterChange(e) {
    // update url with search filters
    this.atType = e.detail['@type'];
    this.type = '';
    this.status = '';
    if( this.atType === 'all results' ) this.atType = '';
    this.currentPage = 1;
    this.downloads = [];
    this.paginationChange = false;
    this._uncheckDownloads();

    this._updateLocation();
  }

  _onSubFilterChange(e) {
    // update url with search filters
    this.atType = e.detail['@type'];
    this.type = e.detail.type;
    this.status = e.detail.status;

    this.currentPage = 1;
    this.downloads = [];
    this.paginationChange = false;
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
