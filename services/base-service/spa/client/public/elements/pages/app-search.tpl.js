import { html } from 'lit';

import { sharedStyles } from '../styles/shared-styles';

import buttonsCss from "@ucd-lib/theme-sass/2_base_class/_buttons.css";

export function render() {
return html`
  <style>
    ${sharedStyles}
    ${buttonsCss}

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
    }
    svg {
      width: 20.22471911px;
      height: 75px;
    }

    .search-content {
      display: block;
      width: 53.5rem;
      padding: 3rem 0rem 4.1875rem 0rem;
      margin: 0 auto;
    }

    .search-results-heading {
      display: flex;
      align-items: center;
      height: 60px;
      padding-top: .8rem;
    }

    .results-count {
      flex: 1 0 0;
      color: var(--ucd-blue-100, #022851);
      font-size: 1.3rem;
      font-style: italic;
      font-weight: 700;
      line-height: 1.74625rem;
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

    @media (max-width: 992px) {
      .search-content {
        width: 90%;
      }
    }
  </style>

  <div class="search-header">
    <div class="search-label">Search</div>
    <div style="display: flex; height: 75px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none">
        <path d="M21.6 0L0 89H24V0H21.6Z" fill="#DBEAF7"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none" style="position: relative; left: -1px">
        <path d="M2.4 89L24 0H0V89H2.4Z" fill="#DBEAF7"/>
      </svg>
    </div>
  </div>

  <div class="search-content">
    <app-search-box
      id="searchBox"
      is-gold
      search-rounded
      @search="${this._onSearch}"
      placeholder="search"
      search-term="${this.searchTerm}">
    </app-search-box>

    <div class="search-results-heading">
      <div class="results-count">${this.searchResults.length} result${this.searchResults === 1 ? '' : 's'} for "${this.searchTerm}"</div>
      <div class="download">
        <a href=""
          @click="${this._downloadClicked}"
          class="btn download">Download</a>
      </div>
    </div>

    <div class="search-results">
      <div class="select-all">
        <input type="checkbox" id="select-all" name="select-all" value="select-all" @click="${this._selectAll}">
        <label for="select-all">Select All</label>
      </div>
      <hr class="search-seperator">

      ${this.displayedResults.map(
        (result) => html`
          <app-search-result-row search-result="${result.position}" .result=${result}></app-search-result-row>
          <hr class="search-seperator">
        `
      )}

      <ucd-theme-pagination
        ?hidden="${this.paginationTotal < 2}"
        current-page=${this.currentPage}
        max-pages=${this.paginationTotal}
        @page-change=${this._onPaginationChange}
        xs-screen>
      </ucd-theme-pagination>

    </div>
  </div>

`;}
