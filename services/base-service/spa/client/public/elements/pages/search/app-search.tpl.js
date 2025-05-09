import { html } from 'lit';

import { sharedStyles } from '../../styles/shared-styles';

import buttonsCss from "@ucd-lib/theme-sass/2_base_class/_buttons.css";
import formsCss from '@ucd-lib/theme-sass/2_base_class/_forms.css';

export function render() {
return html`
  <style>
    ${sharedStyles}
    ${buttonsCss}
    ${formsCss}

    :host {
      display: block;
    }

    .search-header {
      width: 100%;
      display: flex;
      align-items: center;
      height: 75px;
      border-bottom: solid 1px #E5E5E5;
    }

    .search-header .search-label {
      color: var(--ucd-blue-100, #022851);
      font-size: 2.5rem;
      font-style: normal;
      font-weight: 700;
      line-height: 2.5rem;
      padding-right: .7rem;
      padding-left: 1rem;
    }
    svg {
      width: 20.22471911px;
      height: 75px;
    }

    select {
      background-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjYiIHZpZXdCb3g9IjAgMCA4IDYiIGZpbGw9Im5vbmUiPgo8cGF0aCBkPSJNMCAwSDhMNCA2TDAgMFoiIGZpbGw9IiMxMzYzOUUiLz4KPC9zdmc+);
      background-position-y: 13px;
      background-position: right 10px center;
      background-size: 8px 8px;
      background-repeat: no-repeat;
      background-color: transparent;
      appearance: none;
      -webkit-border-radius: 0px;
      padding: 5px 25px 5px 10px;
      font-size: .9rem;
      color: #666;
      border-color: var(--color-aggie-blue-60);
      margin-right: .3rem;
    }

    .search-container {
      display: flex;
      padding: 3rem 3.5625rem 4.1875rem 3.5625rem;
      align-items: flex-start;
      align-content: flex-start;
      gap: 0rem 3.5625rem;
      /* flex-wrap: wrap; */
      margin: auto;
    }

    .search-container .refine-search {
      display: flex;
      padding: 1.1875rem 1.1875rem 1.1875rem 0;
      flex-direction: column;
      align-items: flex-start;
      min-width: 15rem;
    }

    .search-container .refine-search h3 {
      color: var(--ucd-blue-100, #022851);
      font-size: 2.06938rem;
      font-style: italic;
      font-weight: 700;
      line-height: 2.48313rem;
      margin-top: 0;
      margin-bottom: 1.78rem;
    }

    .search-container .search-content {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1.1875rem;
      flex-grow: 1;
    }

    .search-container .search-content > * {
      width: 100%;
      box-sizing: border-box;
    }

    .search-container .open-to {
      display: flex;
      padding: 0rem 0.59375rem;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.59375rem;
      align-self: stretch;
    }

    .search-container .open-to label {
      display: flex;
      align-items: center;
    }

    .search-container .open-to label input[type="checkbox"] {
      margin-right: .5rem;
    }

    .search-results-heading {
      display: flex;
      align-items: center;
      /* height: 60px;
      padding-top: .8rem; */
    }

    .search-content app-search-box {
      padding-bottom: 0.8rem;
    }

    .search-container .open-to-heading h4 {
      margin-bottom: 1.19rem;
      margin-top: 0;
    }

    .search-container .date-filter-heading h4 {
      margin-top: 2.38rem;
      margin-bottom: 1.78rem;
    }

    .results-count {
      flex: 1 0 0;
      color: var(--ucd-blue-100, #022851);
      font-size: 1.3rem;
      font-weight: 700;
      line-height: 1.74625rem;
    }

    .results-count {
      font-style: italic;
    }

    .btn.download {
      padding: 0 1rem;
    }

    .search-seperator {
      display: block;
      height: 1px;
      border: 0;
      border-top: 1px solid var(--color-aggie-blue-40);
      padding: 0;
      margin: 1.19rem 0;
    }

    .refine-search .search-seperator {
      width: 100%;
      margin: 2.38rem 0;
    }

    .select-page-size {
      padding-top: .6rem;
    }

    .select-page-size span {
      color: var(--other-h-3-gray, #666);
      font-size: 1.03875rem;
      font-style: normal;
      font-weight: 400;
      line-height: 1.625rem; /* 156.438% */
    }

    .select-all {
      display: flex;
      flex-direction: row-reverse;
      align-items: center;
      padding-top: .6rem;
    }

    .select-all label {
      color: var(--other-h-3-gray, #666);
      font-size: .95rem;
      font-style: normal;
      font-weight: 400;
      line-height: 1.625rem;
      padding-right: .4rem;
    }

    input[type="checkbox"] {
      height: 1rem;
      width: 1rem;
    }

    .pager__item a, .pager__item--static {
      padding: 0.25rem;
    }

    .btn--invert:before {
      content: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20height%3D%221em%22%20viewBox%3D%220%200%20640%20512%22%3E%3C!--!%20Font%20Awesome%20Free%206.4.2%20by%20%40fontawesome%20-%20https%3A%2F%2Ffontawesome.com%20License%20-%20https%3A%2F%2Ffontawesome.com%2Flicense%20(Commercial%20License)%20Copyright%202023%20Fonticons%2C%20Inc.%20--%3E%3Cpath%20fill%3D%22%2373ABDD%22%20d%3D%22M144%20480C64.5%20480%200%20415.5%200%20336c0-62.8%2040.2-116.2%2096.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4%2071.6-160%20160-160c59.3%200%20111%2032.2%20138.7%2080.2C409.9%20102%20428.3%2096%20448%2096c53%200%2096%2043%2096%2096c0%2012.2-2.3%2023.8-6.4%2034.6C596%20238.4%20640%20290.1%20640%20352c0%2070.7-57.3%20128-128%20128H144zm79-167l80%2080c9.4%209.4%2024.6%209.4%2033.9%200l80-80c9.4-9.4%209.4-24.6%200-33.9s-24.6-9.4-33.9%200l-39%2039V184c0-13.3-10.7-24-24-24s-24%2010.7-24%2024V318.1l-39-39c-9.4-9.4-24.6-9.4-33.9%200s-9.4%2024.6%200%2033.9z%22%2F%3E%3C%2Fsvg%3E");
      width: 2em;
      position: relative;
      left: 0.2rem;
      /* transition: 0.2s all ease-in; */
    }

    .btn--invert {
      width: 165px;
      border-color: var(--color-aggie-blue-50);
      padding: .5rem 1.5rem .5rem .5rem;
      font-size: 1rem;
    }

    .search-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    category-filter-controller {
      width: 100%;
    }

    date-range-filter {
      width: 100%;
    }

    @media (max-width: 992px) {
      .search-content {
        width: 90%;
      }

      .search-container {
        width: 90%;
        padding-right: 0;
        padding-left: 0;
        gap: 0rem 2rem;
      }
    }

    .refine-search-mobile {
      display: none;
    }

    @media (max-width: 767px) {
      .search-header {
        justify-content: space-between;
      }

      .color-border svg {
        display: none;
      }

      .color-border {
        width: 1.125rem;
        background-color: #DBEAF7;
      }

      .search-container .refine-search {
        display: none;
      }

      .refine-search-mobile {
        display: block;
      }

      .search-results-heading {
        display: block;
      }

      .search-results-heading .download {
        display: flex;
        justify-content: flex-end;
        padding-top: 1rem;
      }
    }

    .refine-search-dropdown {
      display: flex;
      padding: 0.625rem 1rem;
      align-items: center;
      gap: 1rem;
      justify-content: space-between;
      align-self: stretch;
      background: var(--ucd-blue-80, #13639E);
      color: white;
    }

    /* .refine-search-dropdown.open {

    } */

    .refine-search-dropdown svg {
      fill: white;
      height: 15px;
      width: 15px;
    }

    .refine-search-label {
      font-size: 1.1875rem;
      font-style: normal;
      font-weight: 700;
      line-height: 1.92125rem;
    }

    .refine-search-mobile.open {
      background: var(--ucd-blue-30, #EBF3FA);
    }

    .refine-search-contents {
      padding: 1rem;
    }

    .refine-search-contents category-filter-controller {
      padding-bottom: 2rem;
    }

    .results-filtered-to {
      display: flex;
      align-items: center;
      color: var(--color-aggie-blue);
      font-size: 1.3rem;
      font-style: italic;
      font-weight: 700;
      word-wrap: break-word;
    }

    .results-filtered-to span {
      padding-right: 0.5rem;
    }

    .results-filtered-to p {
      margin: 0;
    }

    .results-filtered-to button {
      background-color: var(--color-aggie-blue-80);
      color: white;
      border-color: transparent;
      padding: 0.25rem 1rem;
      font-size: 1.1rem;
    }

    .results-filtered-to button:hover {
      color: white;
    }

    .results-filtered-to button .close {
      padding: 0 0 0 0.7rem;
    }

    .results-filtered-to button .close ucdlib-icon {
      padding: 3px;
    }

    .results-filtered-to button:hover .close ucdlib-icon {
      fill: var(--color-aggie-blue-80);
      border-radius: 50%;
      background-color: var(--color-aggie-blue-50);
      /* transition: background-color 0.3s ease-in-out; */
      /* transition: fill 0.3s ease-in-out; */
    }

    .search-scoring,
    .search-scoring input {
      width: 100%;
    }

    .search-scoring h4 {
      margin-bottom: 0;
    }

    .search-scoring input[type="range"] {
      -webkit-appearance: none; /* Remove default styling */
      height: 3px;
      background: #CCE0F3;
    }

    /* === Track Background (WebKit) === */
    .search-scoring input[type="range"]::-webkit-slider-runnable-track {
      height: 3px;
      background: linear-gradient(
        to right,
        #13639E 0%,
        #13639E var(--progress),
        #CCE0F3 var(--progress),
        #CCE0F3 100%
      );
    }

    /* === Thumb/Handle (WebKit) === */
    .search-scoring input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      height: 15px;
      width: 15px;
      background: #13639E;
      margin-top: -5px;
      border-radius: 15px;
      cursor: pointer;
      transition: background 0.3s;
    }

    /* === Track and Thumb for Firefox === */
    .search-scoring input[type="range"]::-moz-range-track {
      height: 3px;
      background: #CCE0F3;
    }

    .search-scoring input[type="range"]::-moz-range-progress {
      background: #13639E;
      height: 3px;
    }

    .search-scoring input[type="range"]::-moz-range-thumb {
      height: 15px;
      width: 15px;
      background: #13639E;
      border-radius: 15px;
      cursor: pointer;
      transition: background 0.3s;
    }

    .slider-container {
      position: relative;
      max-width: 15rem;
      padding-top: 1rem;
    }

    #min-score-slider-label,
    #min-nested-score-slider-label {
      position: absolute;
      top: .25rem;
      transform: translateX(-50%);
      color: #022851;
      font-size: .8rem;
      white-space: nowrap;
      pointer-events: none;

      transform: scale(0);
      transition: transform 200ms linear;
    }

    #min-score-slider-label[moving],
    #min-nested-score-slider-label[moving] {
      transform: scale(1);
    }

  </style>

  <div class="search-header">
    <div class="search-label">Search</div>
    <div class="color-border" style="display: flex; height: 75px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none">
        <path d="M21.6 0L0 89H24V0H21.6Z" fill="#DBEAF7"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none" style="position: relative; left: -1px">
        <path d="M2.4 89L24 0H0V89H2.4Z" fill="#DBEAF7"/>
      </svg>
    </div>
  </div>

  <div class="search-container">
    <div class="refine-search">

      <h3>Refine Results</h3>
      <category-filter-controller
        @filter-change="${this._onFilterChange}"
        @subfilter-change="${this._onSubFilterChange}"
        .searchTerm="${this.searchTerm}"
        .currentPage="${this.currentPage}"
        .resultsPerPage="${this.resultsPerPage}"
        .globalAggregations="${this.globalAggregations}">
      </category-filter-controller>

      <hr class="search-seperator" ?hidden="${!this.showOpenTo}">

      <div class="open-to-heading" ?hidden="${!this.showOpenTo}">
        <h4>Experts Open To</h4>
      </div>
      <div class="open-to" ?hidden="${!this.showOpenTo}">
        <label>
          <input type="checkbox" id="collab-projects" name="collab-projects" value="collab-projects" ?checked="${this.collabProjects}" @click="${this._selectCollabProjects}">
          Collaborative Projects
        </label>
        <label>
          <input type="checkbox" id="comm-partner" name="comm-partner" value="comm-partner" ?checked="${this.commPartner}" @click="${this._selectCommPartner}">
          Community Partnerships
        </label>
        <label>
          <input type="checkbox" id="indust-projects" name="indust-projects" value="indust-projects" ?checked="${this.industProjects}" @click="${this._selectIndustProjects}">
          Industry Projects
        </label>
        <label>
          <input type="checkbox" id="media-interviews" name="media-interviews" value="media-interviews" ?checked="${this.mediaInterviews}" @click="${this._selectMediaInterviews}">
          Media Interviews
        </label>
      </div>

      <!-- <div class="date-filter-heading">
        <h4>Date (Works, Grants)</h4>
      </div>
      <date-range-filter></date-range-filter> -->
      <!-- <range-slider-with-histogram></range-slider-with-histogram> -->

      <div class="search-scoring" ?hidden=${!APP_CONFIG.user.admin}>
        <h4>Search Scoring</h4>
        <div class="slider-container">
          <input type="range" id="min-score-slider" min="0" max="100" value="0" />
          <div id="min-score-slider-label" ?moving="${this.minScoreMoving}">1</div>
          <label for="min-score-slider">min_score: ${this.minScore}</label>
        </div>

        <div class="slider-container">
          <input type="range" id="min-nested-score-slider" min="0" max="100" value="0" />
          <div id="min-nested-score-slider-label" ?moving="${this.minNestedScoreMoving}">1</div>
          <label for="min-nested-score-slider">min_nested_score: ${this.minNestedScore}</label>
        </div>
      </div>
    </div>
    <div class="search-content">
      <app-search-box
        id="searchBox"
        is-gold
        search-rounded
        @search="${(e) => this._onSearch(e, true)}"
        placeholder="search"
        search-term="${this.searchTerm}">
      </app-search-box>

      <div class="refine-search-mobile ${this.refineSearchCollapsed ? '' : 'open'}">
        <div class="refine-search-dropdown ${this.refineSearchCollapsed ? '' : 'open'}" @click=${() => this.refineSearchCollapsed = !this.refineSearchCollapsed}>
          <span class="refine-search-label">Refine Results</span>
          <span class="refine-search-arrow down" ?hidden="${this.refineSearchCollapsed}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z"/></svg></span>
          <span class="refine-search-arrow right" ?hidden="${!this.refineSearchCollapsed}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512"><!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z"/></svg></span>
        </div>
        <div class="refine-search-contents ${this.refineSearchCollapsed ? '' : 'open'}" ?hidden="${this.refineSearchCollapsed}">

          <category-filter-controller
            @filter-change="${this._onFilterChange}"
            @subfilter-change="${this._onSubFilterChange}"
            .mobile="${true}"
            .searchTerm="${this.searchTerm}"
            .currentPage="${this.currentPage}"
            .resultsPerPage="${this.resultsPerPage}"
            .globalAggregations="${this.globalAggregations}">
          </category-filter-controller>

          <div class="open-to-heading" ?hidden="${!this.showOpenTo}">
            <h4>Experts Open To</h4>
          </div>
          <div class="open-to" style="padding: 0" ?hidden="${!this.showOpenTo}">
            <label>
              <input type="checkbox" id="collab-projects" name="collab-projects" value="collab-projects" ?checked="${this.collabProjects}" @click="${this._selectCollabProjects}">
              Collaborative Projects
            </label>
            <label>
              <input type="checkbox" id="comm-partner" name="comm-partner" value="comm-partner" ?checked="${this.commPartner}" @click="${this._selectCommPartner}">
              Community Partnerships
            </label>
            <label>
              <input type="checkbox" id="indust-projects" name="indust-projects" value="indust-projects" ?checked="${this.industProjects}" @click="${this._selectIndustProjects}">
              Industry Projects
            </label>
            <label>
              <input type="checkbox" id="media-interviews" name="media-interviews" value="media-interviews" ?checked="${this.mediaInterviews}" @click="${this._selectMediaInterviews}">
              Media Interviews
            </label>
          </div>
        </div>
      </div>

      <div class="results-filtered-to" ?hidden="${!this.filterByExpert}">
        <span>Experts:</span>
        <p>
          <button class="btn btn--round" @click="${this._removeExpertFilter}">
            ${this.filterByExpertName}
            <div class="close">
              <ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>
            </div>
          </button>
        </p>

      </div>
      <div class="search-results-heading">
        <div class="results-count">${this.totalResultsCount != null ? this.totalResultsCount : this.resultsLoading} result${this.totalResultsCount === 1 ? '' : 's'} for "${this.searchTerm}"</div>
        <div class="download">
          <button class="btn btn--invert" ?disabled="${!this.resultsSelected}" @click="${this._downloadClicked}">Download</button>
        </div>
      </div>

      <div class="search-results">
        <div class="search-heading">
          <div class="select-page-size">
            <select name="page-size" id="page-size" @change="${this._onPageSizeChange}">
              <option value="25" .selected="${this.resultsPerPage === 25}">25</option>
              <option value="50" .selected="${this.resultsPerPage === 50}">50</option>
              <option value="100" .selected="${this.resultsPerPage === 100}">100</option>
            </select>

            <span>items per page</span>
          </div>
          <div class="select-all">
            <input type="checkbox" .checked="${this.allResultsSelected}" id="select-all" name="select-all" value="select-all" @click="${this._selectAll}">
            <label for="select-all">Select All</label>
          </div>

        </div>
        <hr class="search-seperator">

        ${this.displayedResults.map(
          (result) => html`
            <app-search-result-row
              search-result="${result.position}"
              .result=${result}
              result-type="${result.resultType}"
              @filter-by-grants="${this._filterByGrants}"
              @filter-by-works="${this._filterByWorks}"
              @select-result="${this._selectResult}">
            </app-search-result-row>
            <hr class="search-seperator">
          `
        )}

        <ucd-theme-pagination
          ?hidden="${this.paginationTotal < 2}"
          current-page=${this.currentPage}
          max-pages=${this.paginationTotal}
          @page-change=${this._onPaginationChange}
          xs-screen
          ellipses>
        </ucd-theme-pagination>

      </div>
    </div>
  </div>

`;}
