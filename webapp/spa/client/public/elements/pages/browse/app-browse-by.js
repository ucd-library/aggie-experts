import { LitElement, html } from 'lit';
import {render} from "./app-browse-by.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";
import '../../components/ucdlib-browse-az.js';
import '../../components/search-result-row.js';

import utils from '../../../lib/utils/index.js';
import { ORG_LOOKUP } from '../../../lib/org-lookup.js';

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
      mobileSubDrawer : { type : String },
      mobileAffSub : { type : String },
      mobileCategoryOpen : { type : Boolean },
    }
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
    this.mobileSubDrawer = null;
    this.mobileAffSub = null;
    this.mobileCategoryOpen = false;
    this.affiliationCollapsed = true;
    this.dateCollapsed = true;
    this.openToCollapsed = true;
    this.affiliationSearch = '';
    this.expandedSubCategories = [];
    this.categoryAggregations = {};
    this.orgLookup = ORG_LOOKUP
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(cat => ({
        ...cat,
        subCategories: cat.subCategories
          .slice()
          .sort((a, b) => a.label.localeCompare(b.label))
          .map(sub => ({
            ...sub,
            depts: sub.depts.slice().sort((a, b) => a.name.localeCompare(b.name))
          }))
      }));

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

  async _onAppStateUpdate(e) {
    if( e.location.page !== 'browse' ) return;

    this.browseType = e.location.path[1];
    this.letter = e.location.path[2];

    let page = e.location.path[3];
    let resultsPerPage = e.location.path[4];
    let query = e.location.query || {};

    this.dept = query.dept ? query.dept.split(',').filter(Boolean) : [];
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

    // fetch category aggregations (counts for All/Active/etc.) using unfiltered query
    await this._fetchCategoryAggregations();
  }

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

  async _fetchCategoryAggregations() {
    if( this.browseType !== 'grant' && this.browseType !== 'work' ) return;
    try {
      const result = await this.BrowseByModel.browseCounts(this.browseType, {});
      if( result?.state === 'loaded' ) {
        this.categoryAggregations = result.payload?.aggregations || {};
      }
    } catch(e) {
      // ignore - counts will just be empty
    }
  }

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

  async _updateDateRangeData(aggs) {
    if( !aggs ) { this.dateRangeData = []; return; }

    // Only rebuild histogram data when non-date filters change.
    // When only the date range changes, keep the existing histogram so the
    // full range stays visible (greyed-out bars outside the selection).
    const sig = JSON.stringify({
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

    if( sig === this._lastDateHistSig ) {
      // Non-date filters unchanged — just sync slider handles to current selection
      await this.updateComplete;
      this._refreshRangeSlider(false);
      return;
    }
    this._lastDateHistSig = sig;

    // aggregations arrive as flat dicts: { epochMs: count } (transformed by compact_search_results)
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

    if( !yearMap.size ) { this.dateRangeData = []; return; }

    const sorted = Array.from(yearMap.entries()).sort((a, b) => a[0] - b[0]);
    const minY = sorted[0][0];
    const maxY = sorted[sorted.length - 1][0];
    const data = [];
    for( let y = minY; y <= maxY; y++ ) {
      data.push({ stat: y, value: yearMap.get(y) || 0 });
    }
    this.dateRangeData = data;
    await this.updateComplete;
    this._refreshRangeSlider(true);
  }

  async _refreshRangeSlider(dataChanged=true) {
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

  _buildQueryString() {
    const params = [];
    if( this.dept?.length ) params.push(`dept=${this.dept.join(',')}`);
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

  _updateLocation() {
    const path = `/browse/${this.browseType}/${this.letter || 'a'}`;
    const qs = this._buildQueryString();
    this.AppStateModel.setLocation(path + (qs ? '?' + qs : ''));
  }

  _onDeptChange(e) {
    const code = e.currentTarget.value;
    if( e.currentTarget.checked ) {
      if( !this.dept.includes(code) ) this.dept = [...this.dept, code];
    } else {
      this.dept = this.dept.filter(d => d !== code);
    }
    this.currentPage = 1;
    this._updateLocation();
  }

  _onSubCategoryCheck(subDepts) {
    const codes = subDepts.map(d => d.deptCode);
    const checkedCount = codes.filter(c => this.dept.includes(c)).length;
    const allChecked = checkedCount === codes.length;
    if( !allChecked ) {
      const merged = [...this.dept];
      codes.forEach(c => { if( !merged.includes(c) ) merged.push(c); });
      this.dept = merged;
    } else {
      this.dept = this.dept.filter(d => !codes.includes(d));
    }
    this.currentPage = 1;
    this._updateLocation();
  }

  _getDept(code) {
    for( const cat of (this.orgLookup || []) ) {
      for( const sub of cat.subCategories ) {
        const dept = sub.depts.find(d => d.deptCode === code);
        if( dept ) return dept;
      }
    }
    return null;
  }

  _getDeptName(code) {
    return this._getDept(code)?.name || code;
  }

  _deptCodesToNames(codes) {
    return codes.map(c => this._getDept(c)?.officialName || c);
  }

  _toggleSubCategory(label) {
    if( this.expandedSubCategories.includes(label) ) {
      this.expandedSubCategories = this.expandedSubCategories.filter(l => l !== label);
    } else {
      this.expandedSubCategories = [...this.expandedSubCategories, label];
    }
  }

  _removeDeptFilter(code) {
    this.dept = this.dept.filter(d => d !== code);
    this._updateLocation();
  }

  _onAffiliationSearch(e) {
    this.affiliationSearch = e.target.value;
  }

  _renderFilterContents() {
    return html`
      <!-- Categories (Grants and Works only) -->
      ${this.browseType === 'grant' ? html`
        <div class="browse-categories">
          <h3>Categories</h3>
          <div class="category-row ${!this.status ? 'active' : ''}" @click="${() => this._onStatusChange('')}">
            <span class="category-label">All Grants</span>
            <span class="category-count">${this._getCategoryTotal()}</span>
          </div>
          <div class="category-row ${this.status === 'active' ? 'active' : ''}" @click="${() => this._onStatusChange('active')}">
            <span class="category-label">Active</span>
            <span class="category-count">${this._getCategoryCount('status', 'active')}</span>
          </div>
          <div class="category-row ${this.status === 'completed' ? 'active' : ''}" @click="${() => this._onStatusChange('completed')}">
            <span class="category-label">Completed</span>
            <span class="category-count">${this._getCategoryCount('status', 'completed')}</span>
          </div>
        </div>
        <hr class="search-seperator search-seperator--large-dots">
      ` : ''}
      ${this.browseType === 'work' ? html`
        <div class="browse-categories">
          <h3>Categories</h3>
          <div class="category-row ${!this.workType ? 'active' : ''}" @click="${() => this._onWorkTypeChange('')}">
            <span class="category-label">All Works</span>
            <span class="category-count">${this._getCategoryTotal()}</span>
          </div>
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
          ${(this.dept || []).map(code => html`
            <span class="filter-active-item" @click="${() => this._removeDeptFilter(code)}">
              <ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>
              ${this._getDeptName(code)}
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
                    <span class="affiliation-sub-label">${sub.label}</span>
                    <span class="affiliation-sub-caret" @click="${() => this._toggleSubCategory(sub.label)}">
                      ${expanded
                        ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" width="6" height="6"><path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z" fill="var(--ucd-blue-80,#13639E)"/></svg>`
                        : html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="4" height="6"><path d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>`
                      }
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

      <!-- Date filter -->
      <div class="range-filter-container">
        <hr class="search-seperator">
        <div class="collapsible-filter-heading" @click="${() => { this.dateCollapsed = !this.dateCollapsed; if( !this.dateCollapsed ) this._refreshRangeSlider(false); }}">
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
          ${this.browseType === 'grant' ? html`<span class="date-filter-hint" ?hidden="${this.dateRangeData.length < 2}">Grants are shown across their active years</span>` : ''}
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
    `;
  }

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

  _onWorkTypeChange(newType) {
    if( !newType || this.workType === newType ) {
      this.workType = '';
    } else {
      this.workType = newType;
    }
    this.currentPage = 1;
    this._updateLocation();
  }

  _toggleRefineSearch() {
    this.refineSearchCollapsed = !this.refineSearchCollapsed;
    if( this.refineSearchCollapsed ) {
      this.mobileSubDrawer = null;
      this.mobileAffSub = null;
      this.mobileCategoryOpen = false;
    }
    if( !this.refineSearchCollapsed ) this._refreshRangeSlider(false);
  }

  _onRangeSliderChange(e) {
    this.filterByDate = true;
    this.currentPage = 1;
    this.dateFrom = e.detail.min;
    this.dateTo = e.detail.max;
    this.filterByDateLabel = e.detail.min + ' - ' + e.detail.max;
    this._updateLocation();
  }

  _removeDateFilter() {
    this.filterByDate = false;
    this.filterByDateLabel = '';
    this.dateFrom = '';
    this.dateTo = '';
    this._updateLocation();
    const ranges = this.shadowRoot.querySelectorAll('ucdlib-range-slider');
    for( const range of ranges ) range.reset();
  }

  _selectCollabProjects(e) {
    this.collabProjects = e.target.checked;
    this._updateLocation();
  }
  _selectCommPartner(e) {
    this.commPartner = e.target.checked;
    this._updateLocation();
  }
  _selectIndustProjects(e) {
    this.industProjects = e.target.checked;
    this._updateLocation();
  }
  _selectMediaInterviews(e) {
    this.mediaInterviews = e.target.checked;
    this._updateLocation();
  }

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
    this._updateLocation();
  }

  _getActiveFilterCount() {
    let count = 0;
    if( this.dept?.length ) count += this.dept.length;
    if( this.filterByDate ) count++;
    if( this.collabProjects ) count++;
    if( this.commPartner ) count++;
    if( this.industProjects ) count++;
    if( this.mediaInterviews ) count++;
    return count;
  }

  _getCategoryCount(key, value) {
    if( !this.categoryAggregations ) return '';
    const agg = this.categoryAggregations[key];
    if( !agg || typeof agg !== 'object' ) return '';
    const count = agg[value];
    return typeof count === 'number' ? count.toLocaleString() : '0';
  }

  _getCategoryTotal() {
    const agg = this.browseType === 'grant'
      ? this.categoryAggregations?.status
      : this.categoryAggregations?.type;
    if( !agg || typeof agg !== 'object' ) return '';
    const total = Object.values(agg).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
    return total ? total.toLocaleString() : '';
  }

  _getWorkTypeRows() {
    const typeAgg = this.categoryAggregations?.type;
    if( !typeAgg || typeof typeAgg !== 'object' || !Object.keys(typeAgg).length ) {
      const types = [
        { key: 'book', label: 'Books' },
        { key: 'chapter', label: 'Chapters' },
        { key: 'paper-conference', label: 'Conference Papers' },
        { key: 'article-journal', label: 'Journal Articles' },
      ];
      return types.map(t => html`
        <div class="category-row ${this.workType === t.key ? 'active' : ''}" @click="${() => this._onWorkTypeChange(t.key)}">
          <span class="category-label">${t.label}</span>
          <span class="category-count"></span>
        </div>
      `);
    }
    const entries = Object.entries(typeAgg)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => utils.getCitationType(a.key).localeCompare(utils.getCitationType(b.key)));
    return entries.map(({ key, count }) => html`
      <div class="category-row ${this.workType === key ? 'active' : ''}" @click="${() => this._onWorkTypeChange(key)}">
        <span class="category-label">${utils.getCitationType(key)}</span>
        <span class="category-count">${count.toLocaleString()}</span>
      </div>
    `);
  }

  _getWorkTypeLabel(key) {
    return utils.getCitationType(key) || key;
  }

  _getWorkTypeItems() {
    const typeAgg = this.categoryAggregations?.type;
    if( !typeAgg || typeof typeAgg !== 'object' || !Object.keys(typeAgg).length ) {
      const types = [
        { key: 'book', label: 'Books' },
        { key: 'chapter', label: 'Chapters' },
        { key: 'paper-conference', label: 'Conference Papers' },
        { key: 'article-journal', label: 'Journal Articles' },
      ];
      return types.map(t => html`<button class="category-dropdown-item ${this.workType === t.key ? 'active' : ''}" @click="${() => this._onMobileCategoryChange(t.key)}">${t.label}</button>`);
    }
    const entries = Object.entries(typeAgg)
      .map(([key]) => ({ key, label: utils.getCitationType(key) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return entries.map(({ key, label }) => html`<button class="category-dropdown-item ${this.workType === key ? 'active' : ''}" @click="${() => this._onMobileCategoryChange(key)}">${label}</button>`);
  }

  _getWorkTypeOptions() {
    const typeAgg = this.categoryAggregations?.type;
    if( !typeAgg || typeof typeAgg !== 'object' || !Object.keys(typeAgg).length ) {
      const types = [
        { key: 'book', label: 'Books' },
        { key: 'chapter', label: 'Chapters' },
        { key: 'paper-conference', label: 'Conference Papers' },
        { key: 'article-journal', label: 'Journal Articles' },
      ];
      return types.map(t => html`<option value="${t.key}" ?selected="${this.workType === t.key}">${t.label}</option>`);
    }
    const entries = Object.entries(typeAgg)
      .map(([key]) => ({ key, label: utils.getCitationType(key) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return entries.map(({ key, label }) => html`<option value="${key}" ?selected="${this.workType === key}">${label}</option>`);
  }

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
        return `View ${n} ${label}`;
      }
      return `View ${n} work${n === 1 ? '' : 's'}`;
    }
    return `View ${n} results`;
  }

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

  _onMobileCategoryChange(val) {
    this.mobileCategoryOpen = false;
    if( this.browseType === 'grant' ) this._onStatusChange(val);
    else if( this.browseType === 'work' ) this._onWorkTypeChange(val);
  }

  async _refreshRange(dataChanged=false) {
    const ranges = this.shadowRoot?.querySelectorAll('ucdlib-range-slider');
    for( const range of ranges ) {
      if( range && typeof range.refresh === 'function' ) {
        range.refresh(dataChanged);
      }
    }
  }

}

customElements.define('app-browse-by', AppBrowseBy);
