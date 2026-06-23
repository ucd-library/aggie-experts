import { html } from 'lit';

import { sharedStyles } from '../../styles/shared-styles';

import buttonsCss from "@ucd-lib/theme-sass/2_base_class/_buttons.css";
import formsCss from '@ucd-lib/theme-sass/2_base_class/_forms.css';

import '@ucd-lib/theme-elements/ucdlib/ucdlib-range-slider/ucdlib-range-slider.js';

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
      min-width: 18.5rem;
      max-width: 18.5rem;
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
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .search-container .search-content > * {
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
    }

    .search-container .search-content .search-tips-link {
      display: flex;
      align-items: center;
      justify-content: flex-end;

      color: var(--color-aggie-blue-80, #13639E);
      font-size: 1rem;
      font-weight: 400;
      text-decoration: underline;
      line-height: 26px;
      word-wrap: break-word;
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

    .search-container .date-filter-heading {
      margin-bottom: 1.78rem;
    }

    .search-container .date-filter-heading.hidden-slider {
      margin-bottom: 0;
    }

    .search-container .date-filter-heading h4 {
      margin-top: 0;
      margin-bottom: .5rem;
    }
    
    .search-container .date-filter-heading span,
    .date-filter-hint {
      color: #666;
      font-size: .92rem;
    }

    .search-container .search-year {
      size: 1rem;
      font-weight: 400;
      color: black;
      padding-top: 1rem;
    }

    .range-filter-container,
    .open-to-container {
      width: 100%;
    }

    .collapsible-filter-heading {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      padding: 0.6rem 0;
      user-select: none;
      box-sizing: border-box;
      padding-right: 1rem;
    }

    .collapsible-filter-heading h4 {
      margin: 0;
      font-weight: 700;
      color: var(--ucd-blue-100, #022851);
    }

    .filter-collapse-arrow {
      display: flex;
      width: 20px;
      height: 19px;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      flex-shrink: 0;
      color: var(--ucd-blue-80, #13639E);
      font-size: 20px;
      font-weight: 900;
    }

    .filter-collapse-arrow svg {
      fill: var(--ucd-blue-80, #13639E);
    }

    .affiliation-filter-contents {
      width: 100%;
      padding: 0.25rem 0 0.5rem;
    }

    .affiliation-search-wrapper {
      display: flex;
      padding: 1rem;
      align-items: center;
      gap: 10px;
      width: 100%;
      box-sizing: border-box;
      background: var(--ucd-blue-30, #EBF3FA);
      margin-bottom: 0.75rem;
    }

    .affiliation-search-wrapper svg {
      flex-shrink: 0;
      fill: var(--ucd-blue-60, #b0d0ed);
      pointer-events: none;
    }

    .affiliation-search-input {
      flex: 1 0 0;
      background: transparent;
      border: none;
      font-size: 1rem;
      line-height: 1.2;
      color: var(--ucd-blue-80, #13639E);
      outline: none;
      padding: 0;
    }

    .affiliation-search-input::placeholder {
      color: var(--ucd-blue-80, #13639E);
    }

    .affiliation-group-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1rem;
      font-weight: 700;
      color: #666;
      margin: 0.75rem 0 0.4rem;
    }

    .affiliation-group-label::after {
      content: '';
      flex: 1;
      border-bottom: 1px dotted #b0c4d8;
    }

    .affiliation-checkboxes {
      display: flex;
      flex-direction: column;
      gap: 0;
      max-height: 15rem;
      overflow-y: auto;
      scrollbar-color: var(--ucd-blue-80, #13639E) var(--ucd-blue-60, #b0d0ed);
      scrollbar-width: thin;
      padding-right: 1rem;
    }

    .affiliation-checkboxes::-webkit-scrollbar {
      width: 6px;
    }

    .affiliation-checkboxes::-webkit-scrollbar-track {
      background: var(--ucd-blue-60, #b0d0ed);
    }

    .affiliation-checkboxes::-webkit-scrollbar-thumb {
      background: var(--ucd-blue-80, #13639E);
      border-radius: 3px;
    }

    .affiliation-sub-row {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      line-height: 1.2;
      padding: 0.5rem 0;
    }

    .affiliation-sub-checkbox {
      flex-shrink: 0;
      margin-top: 0.15rem;
      accent-color: var(--ucd-blue-70, #4B9CD3);
    }

    .affiliation-sub-label {
      flex: 1;
    }

    .affiliation-toggle {
      cursor: pointer;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      width: 100%;
    }

    .affiliation-sub-caret {
      display: flex;
      align-items: center;
      padding: 0.2rem;
      flex-shrink: 0;
    }

    .affiliation-sub-caret svg {
      height: 17px;
      width: auto;
    }

    .filter-collapse-arrow svg {
      height: 20px;
      width: auto;
    }

    .affiliation-search-wrapper svg {
      width: 1.25rem;
      height: 1.25rem;
    }

    .affiliation-dept-list {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding-left: 1.5rem;
    }

    .affiliation-dept-row {
      display: flex;
      align-items: flex-start;
      line-height: 1.2;
      padding: 0.5rem 0 0.5rem 0.5rem;
      cursor: pointer;
      gap: 0.5rem;
    }

    .affiliation-dept-row input[type="checkbox"] {
      margin-top: 0.15rem;
      flex-shrink: 0;
      accent-color: var(--ucd-blue-70, #4B9CD3);
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
      margin: 0.75rem 0;
      border-top: 1px dotted #b0c4d8;
    }

    .refine-search .search-seperator--large-dots {
      border: none;
      height: 4px;
      background-image: radial-gradient(circle, var(--color-aggie-blue-60, #73ABDD) 2px, transparent 2px);
      background-size: 10px 4px;
      background-repeat: repeat-x;
      background-position: 0 center;
      margin: 1rem 0;
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
      appearance: none;
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      border: 1px solid var(--ucd-blue-70, #73ABDD);
      background: var(--white, #FFF);
      flex-shrink: 0;
      cursor: pointer;
      position: relative;
    }

    input[type="checkbox"]:checked {
      background: var(--ucd-blue-70, #73ABDD);
    }

    input[type="checkbox"]:checked::after {
      content: '';
      position: absolute;
      left: 5px;
      top: 2px;
      width: 6px;
      height: 11px;
      border: 2px solid white;
      border-top: none;
      border-left: none;
      transform: rotate(45deg);
    }

    input[type="checkbox"]:indeterminate {
      background: var(--ucd-blue-70, #73ABDD);
    }

    input[type="checkbox"]:indeterminate::after {
      content: '';
      position: absolute;
      left: 4px;
      top: 8px;
      width: 10px;
      height: 2px;
      background: white;
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

      .refine-search-mobile.open {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9000;
        background: white;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-right: 1.125rem solid var(--ucd-blue-80, #13639E);
        box-sizing: border-box;
      }

      .refine-search-mobile.open .refine-search-dropdown {
        flex-shrink: 0;
        display: flex;
        width: 100%;
        box-sizing: border-box;
        padding: 1rem 1.25rem;
        background: white;
        border-bottom: 1px solid #e5e5e5;
      }

      .refine-search-contents {
        flex: 1;
        overflow-y: auto;
        padding: 1rem 1.25rem;
        background: white;
      }

      .refine-search-contents .affiliation-checkboxes {
        max-height: none;
      }

      .mobile-view-btn-wrap {
        flex-shrink: 0;
        padding: 0 1rem 1rem;
        background: white;
        box-sizing: border-box;
      }

      .mobile-view-btn {
        display: block;
        width: 100%;
        padding: 1rem;
        background: var(--ucd-gold, #FFBF00);
        color: var(--ucd-blue, #022851);
        font-size: 1.1875rem;
        font-weight: 700;
        border: none;
        cursor: pointer;
        text-align: center;
        box-sizing: border-box;
      }

      .mobile-view-btn:hover {
        background: #e6ac00;
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
      display: inline-flex;
      padding: 9px 13px;
      align-items: center;
      gap: 10px;
      background: var(--ucd-blue-40, #DBEAF7);
      color: var(--ucd-blue, #022851);
      cursor: pointer;
    }

    .refine-search-dropdown svg {
      fill: currentColor;
      height: 15px;
      width: 15px;
      flex-shrink: 0;
    }

    .refine-search-label {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.1875rem;
      font-style: normal;
      font-weight: 700;
      line-height: 1.92125rem;
    }

    .refine-search-label svg {
      fill: currentColor;
      height: 18px;
      width: 18px;
      flex-shrink: 0;
    }

    .mobile-sub-back {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--ucd-blue-80, #13639E);
      cursor: pointer;
      font-size: 1rem;
      margin-bottom: 1rem;
      background: none;
      border: none;
      padding: 0;
    }

    .mobile-sub-back svg {
      fill: currentColor;
      height: 20px;
      width: auto;
      flex-shrink: 0;
    }

    /* .refine-search-contents category-filter-controller {
      padding-bottom: 2rem;
    } */

    .results-filtered-to {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      color: var(--color-aggie-blue);
      font-size: 1.3rem;
      font-style: italic;
      font-weight: 700;
    }

    .results-filtered-to span {
      padding-right: 0.5rem;
    }

    .results-filtered-to p,
    .mobile-filter-bar p {
      margin: 0;
      flex-shrink: 0;
    }

    .results-filtered-to button,
    .mobile-filter-bar button {
      background-color: var(--color-aggie-blue-80);
      color: white;
      border-color: transparent;
      padding: 0.25rem 1rem;
      font-size: 1rem;
      white-space: nowrap;
      max-width: 100%;
    }

    .results-filtered-to button:hover,
    .mobile-filter-bar button:hover {
      color: white;
    }

    .results-filtered-to button .close,
    .mobile-filter-bar button .close {
      padding: 0 0 0 0.7rem;
    }

    .results-filtered-to button .close ucdlib-icon,
    .mobile-filter-bar button .close ucdlib-icon {
      padding: 3px;
    }

    .results-filtered-to button:hover .close ucdlib-icon,
    .mobile-filter-bar button:hover .close ucdlib-icon {
      fill: var(--color-aggie-blue-80);
      border-radius: 50%;
      background-color: var(--color-aggie-blue-50);
    }

    .clear-all-filters {
      color: var(--ucd-blue-80, #13639E) !important;
      font-size: 16.62px;
      font-weight: 400;
      font-style: italic;
      line-height: 26px;
      text-decoration: underline;
      cursor: pointer;
      background: none !important;
      border: none !important;
      padding: 0;
      white-space: nowrap;
    }

    .filter-active-summary {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      padding: 0.25rem 0 0.5rem;
    }

    .filter-active-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: black;
      cursor: pointer;
    }

    .filter-active-item ucdlib-icon {
      width: 10px;
      height: 10px;
      flex-shrink: 0;
      color: var(--ucd-blue-80, #13639E);
      fill: var(--ucd-blue-80, #13639E);
    }

    .search-tips-tooltip {
      margin-top: 0;
      font-style: italic;
      line-height: 26px;
      word-wrap: break-word;
      font-size: 1rem;
      font-weight: 400;
    }

    /* constrain the range slider so it never grows past the refine column */
    .search-container .refine-search .slider-container {
      box-sizing: border-box;
      width: 100%;
      min-width: 18.5rem;
      max-width: 18.5rem;
      padding: 0 .75rem;
      overflow: hidden;
    }

    .search-container .refine-search .slider-container ucdlib-range-slider {
      display: block;
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
    }

    .invisible {
      visibility: hidden;
      height: 0;
      overflow: hidden;
    }

    .mobile-only {
      display: none;
    }

    @media (max-width: 767px) {
      .mobile-only {
        display: flex;
      }

      .results-filtered-to {
        display: none;
      }

      .mobile-filter-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem 1.1rem;
      }

      .mobile-filter-bar p {
        margin: 0;
      }
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

      <hr class="search-seperator search-seperator--large-dots">

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
          <input
            type="text"
            class="affiliation-search-input"
            placeholder="Search Affiliation"
            .value="${this.affiliationSearch}"
            @input="${this._onAffiliationSearch}">
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
                    <input type="checkbox"
                      class="affiliation-sub-checkbox"
                      .indeterminate="${someChecked}"
                      .checked="${allChecked}"
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
                          <input type="checkbox"
                            .value="${d.deptCode}"
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

      <div class="open-to-container" ?hidden="${!this.showOpenTo}">
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
        ${this.openToCollapsed ? html`
          <div class="filter-active-summary">
            ${this.collabProjects ? html`<span class="filter-active-item" @click="${() => { this.collabProjects = false; this._updateLocation(); }}"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>Collaborative Projects</span>` : ''}
            ${this.commPartner ? html`<span class="filter-active-item" @click="${() => { this.commPartner = false; this._updateLocation(); }}"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>Community Partnerships</span>` : ''}
            ${this.industProjects ? html`<span class="filter-active-item" @click="${() => { this.industProjects = false; this._updateLocation(); }}"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>Industry Projects</span>` : ''}
            ${this.mediaInterviews ? html`<span class="filter-active-item" @click="${() => { this.mediaInterviews = false; this._updateLocation(); }}"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>Media Interviews</span>` : ''}
          </div>
        ` : ''}
      </div>

      <div class="range-filter-container ${!this.displayedResults.length && !this.filterByDateLabel ? 'invisible' : ''}">
        <hr class="search-seperator">

        <div class="collapsible-filter-heading" @click="${() => { this.dateCollapsed = !this.dateCollapsed; }}">
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
          <span class="date-filter-hint" ?hidden="${this.atType !== 'grant' || this.dateRangeData.length < 2}">Grants are shown across their active years.</span>
          <span class="date-filter-hint" ?hidden="${(this.atType !== 'expert' && this.atType !== '') || this.dateRangeData.length < 2}">Based on associated works and grants; grants are shown across their active years.</span>
          <div class="search-year ${this.dateRangeData.length === 1 ? '' : 'hidden-slider'}" ?hidden="${this.dateRangeData.length > 1}">${this.dateRangeData[0]?.stat}</div>
          <div class="slider-container" ?hidden="${this.dateRangeData.length < 2}">
            <ucdlib-range-slider
              @range-slider-change="${this._onRangeSliderChange}"
              .data="${this.dateRangeData}"
              .showUnknown="${true}">
            </ucdlib-range-slider>
          </div>
        </div>
      </div>

      <hr class="search-seperator">
      <p class="search-tips-tooltip"><strong>Tip: </strong> <a href="/search-tips">Search operators</a> can improve results</p>

    </div>
    <div class="search-content">
      <div class="search-tips-link"><a href="/search-tips">Search Tips</a></div>
      <app-search-box
        id="searchBox"
        is-gold
        search-rounded
        @search="${(e) => this._onSearch(e, true)}"
        placeholder="search"
        search-term="${decodeURIComponent(this.searchTerm)}">
      </app-search-box>

      <div class="refine-search-mobile ${this.refineSearchCollapsed ? '' : 'open'}">
        ${this.refineSearchCollapsed ? html`
          <div class="mobile-filter-bar">
            <div class="refine-search-dropdown" @click=${this._toggleRefineSearch}>
              <span class="refine-search-label">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M3.9 54.9C10.5 40.9 24.5 32 40 32l432 0c15.5 0 29.5 8.9 36.1 22.9s4.6 30.5-5.2 42.5L320 320.9 320 448c0 12.1-6.8 23.2-17.7 28.6s-23.8 4.3-33.5-3l-64-48c-8.1-6-12.8-15.5-12.8-25.6l0-79.1L9 97.3C-.7 85.4-2.8 68.8 3.9 54.9z"/></svg>
                Filter${this._getActiveFilterCount() > 0 ? ` (${this._getActiveFilterCount()})` : ''}
              </span>
            </div>
            ${this.atType ? html`<p><button class="btn btn--round" @click="${this._removeCategoryFilter}">${this._getCategoryChipLabel()}<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
            ${this.filterByExpert ? html`<p><button class="btn btn--round" @click="${this._removeExpertFilter}">${this.filterByExpertName}<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
            ${this.filterByDate ? html`<p><button class="btn btn--round" @click="${this._removeDateFilter}">${this.filterByDateLabel}<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
            ${(this.dept || []).map(code => html`<p><button class="btn btn--round" @click="${() => this._removeDeptFilter(code)}">${this._getDeptName(code)}<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>`)}
            ${this.collabProjects ? html`<p><button class="btn btn--round" @click="${() => { this.collabProjects = false; this._updateLocation(); }}">Collaborative Projects<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
            ${this.commPartner ? html`<p><button class="btn btn--round" @click="${() => { this.commPartner = false; this._updateLocation(); }}">Community Partnerships<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
            ${this.industProjects ? html`<p><button class="btn btn--round" @click="${() => { this.industProjects = false; this._updateLocation(); }}">Industry Projects<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
            ${this.mediaInterviews ? html`<p><button class="btn btn--round" @click="${() => { this.mediaInterviews = false; this._updateLocation(); }}">Media Interviews<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
          </div>
        ` : html`<div class="refine-search-dropdown">
            <span class="refine-search-label" style="font-size:2.06938rem;font-style:italic;font-weight:700;color:var(--ucd-blue-100,#022851);">Refine Results</span>
          </div>`
        }
        <div class="refine-search-contents" ?hidden="${this.refineSearchCollapsed}">

          ${this.mobileSubDrawer === 'affiliation' ? html`
            ${this.mobileAffSub ? html`
              <!-- Sub-category dept list drawer -->
              <button class="mobile-sub-back" @click="${() => { this.mobileAffSub = null; }}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="6" height="10"><path d="M9.4 278.6c-12.5-12.5-12.5-32.8 0-45.3l128-128c9.2-9.2 22.9-11.9 34.9-6.9s19.8 16.6 19.8 29.6l0 256c0 12.9-7.8 24.6-19.8 29.6s-25.7 2.2-34.9-6.9l-128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>
                Back
              </button>
              <h4 style="margin-top:0">${this.mobileAffSub}</h4>
              <div class="affiliation-dept-list">
                ${(() => {
                  const allDepts = (this.orgLookup || []).flatMap(cat => cat.subCategories).find(sub => sub.label === this.mobileAffSub)?.depts || [];
                  return allDepts.map(d => html`
                    <label class="affiliation-dept-row">
                      <input type="checkbox"
                        .value="${d.deptCode}"
                        .checked="${this.dept.includes(d.deptCode)}"
                        @change="${this._onDeptChange}">
                      ${d.name}
                    </label>
                  `);
                })()}
              </div>
            ` : html`
              <!-- Affiliation sub-category list -->
              <button class="mobile-sub-back" @click="${() => { this.mobileSubDrawer = null; }}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="6" height="10"><path d="M9.4 278.6c-12.5-12.5-12.5-32.8 0-45.3l128-128c9.2-9.2 22.9-11.9 34.9-6.9s19.8 16.6 19.8 29.6l0 256c0 12.9-7.8 24.6-19.8 29.6s-25.7 2.2-34.9-6.9l-128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>
                Back
              </button>
              <h4 style="margin-top:0">Affiliation</h4>
              <div class="affiliation-search-wrapper">
                <input
                  type="text"
                  class="affiliation-search-input"
                  placeholder="Search Affiliation"
                  .value="${this.affiliationSearch}"
                  @input="${this._onAffiliationSearch}">
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
                      return html`
                        <div class="affiliation-sub-row" style="cursor:pointer" @click="${() => { this.mobileAffSub = sub.label; }}">
                          <span class="affiliation-sub-label">${sub.label}</span>
                          <span class="affiliation-sub-caret">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="4" height="6"><path d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>
                          </span>
                        </div>
                      `;
                    })}
                  `;
                })}
              </div>
            `}

          ` : this.mobileSubDrawer === 'openTo' ? html`
            <button class="mobile-sub-back" @click="${() => { this.mobileSubDrawer = null; }}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="6" height="10"><path d="M9.4 278.6c-12.5-12.5-12.5-32.8 0-45.3l128-128c9.2-9.2 22.9-11.9 34.9-6.9s19.8 16.6 19.8 29.6l0 256c0 12.9-7.8 24.6-19.8 29.6s-25.7 2.2-34.9-6.9l-128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>
              Back
            </button>
            <h4 style="margin-top:0">Experts Open To</h4>
            <div class="open-to">
              <label>
                <input type="checkbox" id="m-collab-projects" name="collab-projects" value="collab-projects" ?checked="${this.collabProjects}" @click="${this._selectCollabProjects}">
                Collaborative Projects
              </label>
              <label>
                <input type="checkbox" id="m-comm-partner" name="comm-partner" value="comm-partner" ?checked="${this.commPartner}" @click="${this._selectCommPartner}">
                Community Partnerships
              </label>
              <label>
                <input type="checkbox" id="m-indust-projects" name="indust-projects" value="indust-projects" ?checked="${this.industProjects}" @click="${this._selectIndustProjects}">
                Industry Projects
              </label>
              <label>
                <input type="checkbox" id="m-media-interviews" name="media-interviews" value="media-interviews" ?checked="${this.mediaInterviews}" @click="${this._selectMediaInterviews}">
                Media Interviews
              </label>
            </div>

          ` : this.mobileSubDrawer === 'date' ? html`
            <button class="mobile-sub-back" @click="${() => { this.mobileSubDrawer = null; }}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="6" height="10"><path d="M9.4 278.6c-12.5-12.5-12.5-32.8 0-45.3l128-128c9.2-9.2 22.9-11.9 34.9-6.9s19.8 16.6 19.8 29.6l0 256c0 12.9-7.8 24.6-19.8 29.6s-25.7 2.2-34.9-6.9l-128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>
              Back
            </button>
            <h4 style="margin-top:0">Date</h4>
            <span class="date-filter-hint" ?hidden="${this.atType !== 'grant' || this.dateRangeData.length < 2}">Grants are shown across their active years.</span>
            <span class="date-filter-hint" ?hidden="${(this.atType !== 'expert' && this.atType !== '') || this.dateRangeData.length < 2}">Based on associated works and grants; grants are shown across their active years.</span>
            <div class="search-year ${this.dateRangeData.length === 1 ? '' : 'hidden-slider'}" ?hidden="${this.dateRangeData.length > 1}">${this.dateRangeData[0]?.stat}</div>
            <div class="slider-container" ?hidden="${this.dateRangeData.length < 2}">
              <ucdlib-range-slider
                @range-slider-change="${this._onRangeSliderChange}"
                .data="${this.dateRangeData}"
                .showUnknown="${true}">
              </ucdlib-range-slider>
            </div>

          ` : html`
            <category-filter-controller
              @filter-change="${this._onFilterChange}"
              @subfilter-change="${this._onSubFilterChange}"
              .mobile="${true}"
              .searchTerm="${this.searchTerm}"
              .currentPage="${this.currentPage}"
              .resultsPerPage="${this.resultsPerPage}"
              .globalAggregations="${this.globalAggregations}">
            </category-filter-controller>

            <hr class="search-seperator search-seperator--large-dots">

            <div class="collapsible-filter-heading" @click="${() => { this.mobileSubDrawer = 'affiliation'; }}">
              <h4>Affiliation</h4>
              <span class="filter-collapse-arrow">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="10" height="16"><path d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>
              </span>
            </div>
            ${this.dept?.length ? html`
              <div class="filter-active-summary">
                ${(this.dept || []).map(code => html`
                  <span class="filter-active-item" @click="${(e) => { e.stopPropagation(); this._removeDeptFilter(code); }}">
                    <ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>
                    ${this._getDeptName(code)}
                  </span>
                `)}
              </div>
            ` : ''}
            <hr class="search-seperator">

            <div ?hidden="${!this.showOpenTo}">
              <div class="collapsible-filter-heading" @click="${() => { this.mobileSubDrawer = 'openTo'; }}">
                <h4>Experts Open To</h4>
                <span class="filter-collapse-arrow">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="10" height="16"><path d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>
                </span>
              </div>
              ${(this.collabProjects || this.commPartner || this.industProjects || this.mediaInterviews) ? html`
                <div class="filter-active-summary">
                  ${this.collabProjects ? html`<span class="filter-active-item" @click="${(e) => { e.stopPropagation(); this.collabProjects = false; this._updateLocation(); }}"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>Collaborative Projects</span>` : ''}
                  ${this.commPartner ? html`<span class="filter-active-item" @click="${(e) => { e.stopPropagation(); this.commPartner = false; this._updateLocation(); }}"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>Community Partnerships</span>` : ''}
                  ${this.industProjects ? html`<span class="filter-active-item" @click="${(e) => { e.stopPropagation(); this.industProjects = false; this._updateLocation(); }}"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>Industry Projects</span>` : ''}
                  ${this.mediaInterviews ? html`<span class="filter-active-item" @click="${(e) => { e.stopPropagation(); this.mediaInterviews = false; this._updateLocation(); }}"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>Media Interviews</span>` : ''}
                </div>
              ` : ''}
              <hr class="search-seperator">
            </div>

            <div class="collapsible-filter-heading ${!this.displayedResults.length && !this.filterByDateLabel ? 'invisible' : ''}" @click="${() => { this.mobileSubDrawer = 'date'; }}">
              <h4>Date</h4>
              <span class="filter-collapse-arrow">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="10" height="16"><path d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z" fill="var(--ucd-blue-80,#13639E)"/></svg>
              </span>
            </div>
            ${this.filterByDate ? html`
              <div class="filter-active-summary">
                <span class="filter-active-item" @click="${(e) => { e.stopPropagation(); this._removeDateFilter(); }}">
                  <ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>${this.filterByDateLabel}
                </span>
              </div>
            ` : ''}
            <hr class="search-seperator">

            <p class="search-tips-tooltip"><strong>Tip: </strong> <a href="/search-tips">Search operators</a> can improve results</p>
          `}
        </div>
        ${!this.refineSearchCollapsed ? html`
          <div class="mobile-view-btn-wrap">
            <button class="mobile-view-btn" @click="${this._toggleRefineSearch}">${this._getMobileViewLabel()}</button>
          </div>
        ` : ''}
      </div>

      <div class="results-filtered-to" ?hidden="${!this.filterByExpert && !this.filterByDate && !this.dept?.length && !this.collabProjects && !this.commPartner && !this.industProjects && !this.mediaInterviews}">
        <p ?hidden="${!this.filterByExpert}">
          <button class="btn btn--round" @click="${this._removeExpertFilter}">
            ${this.filterByExpertName}
            <div class="close">
              <ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>
            </div>
          </button>
        </p>
        <p ?hidden="${!this.filterByDate}">
          <button class="btn btn--round" @click="${this._removeDateFilter}">
            ${this.filterByDateLabel}
            <div class="close">
              <ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>
            </div>
          </button>
        </p>
        ${(this.dept || []).map(code => html`
          <p>
            <button class="btn btn--round" @click="${() => this._removeDeptFilter(code)}">
              ${this._getDeptName(code)}
              <div class="close">
                <ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>
              </div>
            </button>
          </p>
        `)}
        ${this.collabProjects ? html`<p><button class="btn btn--round" @click="${() => { this.collabProjects = false; this._updateLocation(); }}">Collaborative Projects<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
        ${this.commPartner ? html`<p><button class="btn btn--round" @click="${() => { this.commPartner = false; this._updateLocation(); }}">Community Partnerships<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
        ${this.industProjects ? html`<p><button class="btn btn--round" @click="${() => { this.industProjects = false; this._updateLocation(); }}">Industry Projects<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
        ${this.mediaInterviews ? html`<p><button class="btn btn--round" @click="${() => { this.mediaInterviews = false; this._updateLocation(); }}">Media Interviews<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
        ${(() => {
          const count = (this.filterByExpert?1:0) + (this.filterByDate?1:0) + (this.dept?.length||0) + (this.collabProjects?1:0) + (this.commPartner?1:0) + (this.industProjects?1:0) + (this.mediaInterviews?1:0);
          return count >= 2 ? html`<button class="clear-all-filters" @click="${this._clearAllFilters}">Clear all</button>` : '';
        })()}
      </div>
      <div class="search-results-heading">
        <div class="results-count">${this.totalResultsCount != null ? this.totalResultsCount : this.resultsLoading} result${this.totalResultsCount === 1 ? '' : 's'} for "${decodeURIComponent(this.searchTerm)}"</div>
        <div class="download">
          <button class="btn btn--invert" style="width: fit-content;" ?disabled="${!this.resultsSelected}" @click="${this._downloadClicked}">Download</button>
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
