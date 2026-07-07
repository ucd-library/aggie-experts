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

    .browse-header {
      width: 100%;
      display: flex;
      align-items: center;
      height: 75px;
      border-bottom: solid 1px #E5E5E5;
    }

    .browse-header .browse-label {
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

    .browse-container {
      display: flex;
      padding: 3rem 3.5625rem 4.1875rem 3.5625rem;
      align-items: flex-start;
      gap: 0rem 3.5625rem;
      margin: auto;
    }

    /* ---- sidebar ---- */
    .browse-filters {
      display: flex;
      padding: 1.1875rem 1.1875rem 1.1875rem 0;
      flex-direction: column;
      align-items: flex-start;
      min-width: 18.5rem;
      max-width: 18.5rem;
    }

    .browse-filters h3 {
      color: var(--ucd-blue-100, #022851);
      font-size: 2.06938rem;
      font-style: italic;
      font-weight: 700;
      line-height: 2.48313rem;
      margin-top: 0;
      margin-bottom: 1.78rem;
    }

    /* ---- main content ---- */
    .browse-content {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      flex-grow: 1;
      min-width: 0;
    }

    .browse-results-heading {
      padding-top: .8rem;
      width: 100%;
    }

    .browse-results {
      width: 100%;
    }

    .browse-seperator {
      display: block;
      height: 1px;
      border: 0;
      border-top: 4px dotted var(--color-aggie-gold);
      padding: 0;
      margin: 1.19rem 0;
      width: 100%;
    }

    .browse-seperator--grant {
      border-top-color: var(--color-thiebaud-icing);
    }

    .browse-seperator--work {
      border-top-color: var(--color-sage);
    }

    .search-seperator {
      display: block;
      height: 1px;
      border: 0;
      border-top: 1px solid var(--color-aggie-blue-40);
      padding: 0;
      margin: 1.19rem 0;
      width: 100%;
    }

    .browse-filters .search-seperator {
      margin: 0.75rem 0;
      border-top: 1px dotted #b0c4d8;
    }

    .browse-filters .search-seperator--large-dots {
      border: none;
      height: 4px;
      background-image: radial-gradient(circle, var(--color-aggie-blue-60, #73ABDD) 2px, transparent 2px);
      background-size: 10px 4px;
      background-repeat: repeat-x;
      background-position: 0 center;
      margin: 1rem 0;
    }

    /* ---- categories ---- */
    .browse-categories {
      width: 100%;
      margin-bottom: 0.5rem;
    }

    .browse-categories h3 {
      color: var(--ucd-blue-100, #022851);
      font-size: 1.3rem;
      font-style: italic;
      font-weight: 700;
      margin: 0 0 0.75rem;
    }

    category-filter-row {
      cursor: pointer;
      display: block;
    }

    /* ---- collapsible filter headings ---- */
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
    }

    .filter-collapse-arrow svg {
      fill: var(--ucd-blue-80, #13639E);
      height: 20px;
      width: auto;
    }

    /* ---- affiliation ---- */
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
      width: 1.25rem;
      height: 1.25rem;
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
      overflow-y: scroll;
      scrollbar-gutter: stable;
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

    /* ---- open to ---- */
    .open-to-container {
      width: 100%;
    }

    .open-to {
      display: flex;
      padding: 0rem 0.59375rem;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.59375rem;
      align-self: stretch;
    }

    .open-to label {
      display: flex;
      align-items: center;
    }

    .open-to label input[type="checkbox"] {
      margin-right: .5rem;
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

    /* ---- date ---- */
    .range-filter-container {
      width: 100%;
    }

    .date-filter-hint {
      color: #666;
      font-size: .92rem;
    }

    .search-year {
      font-size: 1rem;
      font-weight: 400;
      color: black;
      padding-top: 1rem;
    }

    .slider-container {
      box-sizing: border-box;
      width: 100%;
      min-width: 18.5rem;
      max-width: 18.5rem;
      padding: 0 .75rem;
      overflow: hidden;
    }

    .slider-container ucdlib-range-slider {
      display: block;
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
    }

    /* ---- active filter summary (collapsed state) ---- */
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

    /* ---- results-filtered-to chips ---- */
    .results-filtered-to {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      color: var(--color-aggie-blue);
      font-size: 1.3rem;
      font-style: italic;
      font-weight: 700;
      padding: .5rem 0 1rem;
    }

    .results-filtered-to p {
      margin: 0;
      flex-shrink: 0;
    }

    .results-filtered-to button {
      background-color: var(--color-aggie-blue-80);
      color: white;
      border-color: transparent;
      padding: 0.25rem 1rem;
      font-size: 1rem;
      white-space: nowrap;
      max-width: 100%;
    }

    .results-filtered-to button:hover {
      color: white;
    }

    .results-filtered-to button .close {
      padding: 0 0 0 0.7rem;
    }

    .results-filtered-to button:hover .close ucdlib-icon {
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

    /* ---- browse heading / results ---- */
    .browse-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    h3 {
      font-size: 2.49375rem;
      margin: 0.5rem 0 1rem;
    }

    .color-border.expert svg path {
      fill: var(--color-aggie-gold);
    }

    .color-border.grant svg path {
      fill: var(--color-thiebaud-icing);
    }

    .color-border.work svg path {
      fill: var(--color-sage);
    }

    .pager__item a, .pager__item--static {
      padding: 0.25rem;
    }

    @media (max-width: 992px) {
      .browse-container {
        width: 90%;
        padding-right: 0;
        padding-left: 0;
        gap: 0rem 2rem;
      }

      .browse-content {
        width: 90%;
      }
    }

    .refine-search-mobile {
      display: none;
    }

    @media (max-width: 767px) {
      .browse-header {
        justify-content: space-between;
      }

      .color-border svg {
        display: none;
      }

      .color-border {
        width: 1.125rem;
      }

      .color-border.expert {
        background-color: var(--color-aggie-gold);
      }

      .color-border.grant {
        background-color: var(--color-thiebaud-icing);
      }

      .color-border.work {
        background-color: var(--color-sage);
      }

      .browse-filters {
        display: none;
      }

      .browse-container {
        padding: 0;
        gap: 0;
      }

      .browse-content {
        width: 100%;
        padding: 0;
      }

      .browse-results-heading {
        padding: 0.75rem 0 0 1rem;
        width: 100%;
        box-sizing: border-box;
      }

      .browse-results {
        padding: 0 1rem;
        box-sizing: border-box;
        width: 100%;
      }

      .browse-content > .results-filtered-to {
        padding-left: 1rem;
        padding-right: 1rem;
        box-sizing: border-box;
        font-size: 1rem;
      }

      .refine-search-mobile {
        display: block;
        width: 100%;
        padding-left: .25rem;
      }
    }

    @media (max-width: 767px) {
      .refine-search-panel {
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
        border-right: 1.5rem solid rgba(19, 99, 158, 0.5);
        box-sizing: border-box;
        transform: translateX(-100%);
        opacity: 0.95;
        pointer-events: none;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }

      .refine-search-panel.open {
        transform: translateX(0);
        opacity: 1;
        pointer-events: auto;
      }

      .refine-search-panel .refine-search-drawer-header {
        flex-shrink: 0;
        display: flex;
        width: 100%;
        box-sizing: border-box;
        padding: 1rem 1.25rem 1rem;
        background: white;
      }

      .refine-search-drawer-dots {
        flex-shrink: 0;
        height: 4px;
        background-image: radial-gradient(circle, var(--color-aggie-blue-60, #73ABDD) 2px, transparent 2px);
        background-size: 10px 4px;
        background-repeat: repeat-x;
        background-position: 0 center;
        margin: 0 1rem 0.5rem;
      }

      .refine-search-contents {
        flex: 1;
        overflow-y: auto;
        padding: 1rem 2rem 1rem 1.25rem;
        background: white;
      }

      .refine-search-contents .affiliation-checkboxes {
        max-height: none;
      }

      .mobile-view-btn-wrap {
        flex-shrink: 0;
        padding: 1rem;
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

      .mobile-filter-bar {
        width: 100%;
        padding: 0.75rem 1rem;
        box-sizing: border-box;
      }

      .mobile-filter-bar-row {
        display: flex;
        align-items: stretch;
        gap: 0.75rem;
      }

      .mobile-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem 0.75rem;
        margin-top: 0.4rem;
      }

      .mobile-chips p {
        margin: 0;
        flex-shrink: 1;
        min-width: 0;
        max-width: 100%;
      }

      .mobile-chips button {
        white-space: normal;
        word-break: break-word;
        max-width: 100%;
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

      .category-select-wrapper {
        position: relative;
        flex: 1 1 auto;
        min-width: 0;
      }

      .category-select-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 9px 13px;
        background: var(--ucd-blue-80, #13639E);
        color: white;
        border: none;
        font-size: 1.1875rem;
        font-weight: 700;
        cursor: pointer;
        text-align: left;
      }

      .category-select-btn svg {
        fill: white;
        flex-shrink: 0;
        margin-left: 0.5rem;
        width: 14px;
        height: 14px;
        transition: transform 0.2s ease;
      }

      .category-select-btn.open svg {
        transform: rotate(180deg);
      }

      .category-dropdown-list {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 200;
        background: white;
        border: 1px solid var(--ucd-blue-80, #13639E);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }

      .category-dropdown-item {
        display: block;
        width: 100%;
        padding: 1rem 1rem;
        font-size: 1.1875rem;
        font-weight: 400;
        color: var(--ucd-blue-100, #022851);
        background: white;
        border: none;
        border-bottom: 1px solid var(--ucd-blue-30, #EBF3FA);
        text-align: left;
        cursor: pointer;
        box-sizing: border-box;
      }

      .category-dropdown-item:last-child {
        border-bottom: none;
      }

      .category-dropdown-item:hover,
      .category-dropdown-item.active {
        background: var(--ucd-blue-30, #EBF3FA);
      }

      .category-dropdown-item.active {
        font-weight: 700;
        color: var(--ucd-blue-100, #022851);
      }

      .mobile-filter-bar-row .refine-search-dropdown {
        flex: 0 0 auto;
        display: flex;
      }

      .mobile-chips {
        display: none;
      }
    }

    .refine-search-drawer-header {
      font-size: 2.06938rem;
      font-style: italic;
      font-weight: 700;
      color: var(--ucd-blue-100, #022851);
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
      flex-shrink: 0;
    }

    .refine-search-label {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.1875rem;
      font-weight: 700;
      line-height: 1.92125rem;
    }

    .refine-search-label svg {
      fill: currentColor;
      height: 18px;
      width: 18px;
      flex-shrink: 0;
    }

    .results-filtered-to button {
      background-color: var(--color-aggie-blue-80);
      color: white;
      border-color: transparent;
      padding: 0.25rem 1rem;
      font-size: 1rem;
      white-space: nowrap;
      max-width: 100%;
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
    }

    .mobile-filter-bar button {
      background-color: var(--color-aggie-blue-80);
      color: white;
      border-color: transparent;
      font-size: 1.1rem;
      white-space: nowrap;
      max-width: 100%;
    }

    .mobile-filter-bar button:hover {
      color: white;
    }

    .mobile-filter-bar button .close {
      padding: 0 0 0 0.7rem;
    }

    .mobile-filter-bar button .close ucdlib-icon {
      padding: 3px;
    }

    .mobile-filter-bar button:hover .close ucdlib-icon {
      fill: var(--color-aggie-blue-80);
      border-radius: 50%;
      background-color: var(--color-aggie-blue-50);
    }

    .no-results {
      flex: 1 0 0;
      color: var(--ucd-blue-100, #022851);
      font-size: 1.3rem;
      font-weight: 700;
      line-height: 1.74625rem;
      font-style: italic;
    }
  </style>

  <div class="browse-header">
    <div class="browse-label">${this.browseType.charAt(0).toUpperCase() + this.browseType.slice(1)}s</div>
    <div class="color-border ${this.browseType}" style="display: flex; height: 75px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none">
        <path d="M21.6 0L0 89H24V0H21.6Z" fill="#FFBF00"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none" style="position: relative; left: -1px">
        <path d="M2.4 89L24 0H0V89H2.4Z" fill="#FFBF00"/>
      </svg>
    </div>
  </div>

  <div class="browse-container">

    <!-- ======= SIDEBAR FILTERS ======= -->
    <div class="browse-filters">

      ${this._renderFilterContents()}

    </div>

    <!-- ======= MAIN CONTENT ======= -->
    <div class="browse-content">

    <!-- ======= MOBILE FILTER DRAWER ======= -->
    <div class="refine-search-mobile">
      <div class="mobile-filter-bar">
        <div class="mobile-filter-bar-row">
          ${(this.browseType === 'work' || this.browseType === 'grant') ? html`
            <div class="category-select-wrapper">
              <button class="category-select-btn ${this.mobileCategoryOpen ? 'open' : ''}" @click="${() => { this.mobileCategoryOpen = !this.mobileCategoryOpen; }}">
                <span>${this._getMobileCategoryLabel()}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z"/></svg>
              </button>
              ${this.mobileCategoryOpen ? html`
                <div class="category-dropdown-list">
                  ${this.browseType === 'grant' ? html`
                    <button class="category-dropdown-item ${!this.status ? 'active' : ''}" @click="${() => this._onMobileCategoryChange('')}">All Grants</button>
                    <button class="category-dropdown-item ${this.status === 'active' ? 'active' : ''}" @click="${() => this._onMobileCategoryChange('active')}">Active</button>
                    <button class="category-dropdown-item ${this.status === 'completed' ? 'active' : ''}" @click="${() => this._onMobileCategoryChange('completed')}">Completed</button>
                  ` : html`
                    <button class="category-dropdown-item ${!this.workType ? 'active' : ''}" @click="${() => this._onMobileCategoryChange('')}">All Works</button>
                    ${this._getWorkTypeItems()}
                  `}
                </div>
              ` : ''}
            </div>
          ` : ''}
          <div class="refine-search-dropdown" @click="${this._toggleRefineSearch}">
            <span class="refine-search-label">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M3.9 54.9C10.5 40.9 24.5 32 40 32l432 0c15.5 0 29.5 8.9 36.1 22.9s4.6 30.5-5.2 42.5L320 320.9 320 448c0 12.1-6.8 23.2-17.7 28.6s-23.8 4.3-33.5-3l-64-48c-8.1-6-12.8-15.5-12.8-25.6l0-79.1L9 97.3C-.7 85.4-2.8 68.8 3.9 54.9z"/></svg>
              Filter${this._getActiveFilterCount() > 0 ? ` (${this._getActiveFilterCount()})` : ''}
            </span>
          </div>
        </div>
        <div class="mobile-chips">
          ${this.filterByDate ? html`<p><button class="btn btn--round" @click="${this._removeDateFilter}">${this.filterByDateLabel}<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
          ${this._getDeptPillGroups(this.dept || []).map(group => html`<p><button class="btn btn--round" @click="${() => { this.dept = this.dept.filter(c => !group.codes.includes(c)); this._updateLocation(); }}">${group.label}<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>`)}
          ${this.collabProjects ? html`<p><button class="btn btn--round" @click="${() => { this.collabProjects = false; this._updateLocation(); }}">Collaborative Projects<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
          ${this.commPartner ? html`<p><button class="btn btn--round" @click="${() => { this.commPartner = false; this._updateLocation(); }}">Community Partnerships<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
          ${this.industProjects ? html`<p><button class="btn btn--round" @click="${() => { this.industProjects = false; this._updateLocation(); }}">Industry Projects<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
          ${this.mediaInterviews ? html`<p><button class="btn btn--round" @click="${() => { this.mediaInterviews = false; this._updateLocation(); }}">Media Interviews<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
          ${(() => {
            const count = (this.filterByDate?1:0) + this._getDeptPillGroups(this.dept||[]).length + (this.collabProjects?1:0) + (this.commPartner?1:0) + (this.industProjects?1:0) + (this.mediaInterviews?1:0);
            return count >= 2 ? html`<button class="clear-all-filters" @click="${this._clearAllFilters}">Clear all</button>` : '';
          })()}
        </div>
      </div>

      <div class="refine-search-panel ${this.refineSearchCollapsed ? '' : 'open'}">
        <div class="refine-search-drawer-header">Filter</div>
        <div class="refine-search-drawer-dots"></div>
        <div class="refine-search-contents">
          ${this._renderFilterContents(true)}
        </div>
        <div class="mobile-view-btn-wrap">
          <button class="mobile-view-btn" @click="${this._toggleRefineSearch}">${this._getMobileViewLabel()}</button>
        </div>
      </div>
    </div>

      <div class="browse-results-heading">
        <ucdlib-browse-az .azFilters="${this._buildFilters()}" .azQueryString="${this._buildQueryString()}"></ucdlib-browse-az>
      </div>

      

      <div class="browse-results">
        <div class="browse-heading"></div>
        <hr class="browse-seperator browse-seperator--${this.browseType}">

        <!-- Active filter chips -->
      ${this._getActiveFilterCount() > 0 ? html`
        <div class="results-filtered-to">
          ${this._getDeptPillGroups(this.dept || []).map(group => html`
            <p>
              <button class="btn btn--round" @click="${() => { this.dept = this.dept.filter(c => !group.codes.includes(c)); this._updateLocation(); }}">
                ${group.label}
                <div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div>
              </button>
            </p>
          `)}
          ${this.filterByDate ? html`
            <p>
              <button class="btn btn--round" @click="${this._removeDateFilter}">
                ${this.filterByDateLabel}
                <div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div>
              </button>
            </p>
          ` : ''}
          ${this.collabProjects ? html`<p><button class="btn btn--round" @click="${() => { this.collabProjects = false; this._updateLocation(); }}">Collaborative Projects<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
          ${this.commPartner ? html`<p><button class="btn btn--round" @click="${() => { this.commPartner = false; this._updateLocation(); }}">Community Partnerships<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
          ${this.industProjects ? html`<p><button class="btn btn--round" @click="${() => { this.industProjects = false; this._updateLocation(); }}">Industry Projects<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
          ${this.mediaInterviews ? html`<p><button class="btn btn--round" @click="${() => { this.mediaInterviews = false; this._updateLocation(); }}">Media Interviews<div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div></button></p>` : ''}
          ${this._getActiveFilterCount() >= 2 ? html`<button class="clear-all-filters" @click="${this._clearAllFilters}">Clear all</button>` : ''}
        </div>
      ` : ''}

        ${this._renderResults()}
        ${!this.loading && this.displayedResults.length === 0 ? html`<p class="no-results">0 results</p>
            ` : ''}

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
