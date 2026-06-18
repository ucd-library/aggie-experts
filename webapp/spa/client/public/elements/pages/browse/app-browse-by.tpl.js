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
      gap: 1.1875rem;
      flex-grow: 1;
      min-width: 0;
      padding-top: 3rem;
    }

    .browse-results-heading {
      padding-top: .8rem;
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

    .category-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.3rem 0.5rem;
      cursor: pointer;
      border-radius: 3px;
    }

    .category-row:hover {
      background: var(--ucd-blue-30, #EBF3FA);
    }

    .category-row.active {
      background: var(--ucd-blue-80, #13639E);
      color: white;
    }

    .category-row .category-label {
      font-size: 1rem;
      font-weight: 400;
    }

    .category-row.active .category-label {
      color: white;
    }

    .category-row .category-count {
      font-size: 0.9rem;
      color: #666;
    }

    .category-row.active .category-count {
      color: white;
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
      padding: 0.5rem 0.75rem;
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
      width: 16px;
      height: 16px;
    }

    .affiliation-search-input {
      flex: 1 0 0;
      background: transparent;
      border: none;
      font-family: "Proxima Nova", sans-serif;
      font-size: 19px;
      font-weight: 400;
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
      font-size: 0.75rem;
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
      max-height: 280px;
      overflow-y: auto;
      scrollbar-color: var(--ucd-blue-80, #13639E) var(--ucd-blue-60, #b0d0ed);
      scrollbar-width: thin;
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
      padding: 0.15rem 0;
    }

    .affiliation-sub-checkbox {
      flex-shrink: 0;
      margin-top: 0.15rem;
      accent-color: var(--ucd-blue-70, #4B9CD3);
    }

    .affiliation-sub-label {
      flex: 1;
    }

    .affiliation-sub-caret {
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 0.2rem;
      flex-shrink: 0;
    }

    .affiliation-sub-caret svg {
      height: 14px;
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
      padding: 0.2rem 0;
      cursor: pointer;
    }

    .affiliation-dept-row input[type="checkbox"] {
      margin-right: .5rem;
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
      gap: 0.35rem;
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
      font-size: 1.1rem;
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
        padding-right: 0;
        padding-left: 0;
        gap: 0rem 2rem;
      }

      .browse-content {
        width: 90%;
      }
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

      .browse-content {
        width: 100%;
        padding-top: 1rem;
      }
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
            <label>
              <input type="checkbox" id="b-collab-projects" ?checked="${this.collabProjects}" @click="${this._selectCollabProjects}">
              Collaborative Projects
            </label>
            <label>
              <input type="checkbox" id="b-comm-partner" ?checked="${this.commPartner}" @click="${this._selectCommPartner}">
              Community Partnerships
            </label>
            <label>
              <input type="checkbox" id="b-indust-projects" ?checked="${this.industProjects}" @click="${this._selectIndustProjects}">
              Industry Projects
            </label>
            <label>
              <input type="checkbox" id="b-media-interviews" ?checked="${this.mediaInterviews}" @click="${this._selectMediaInterviews}">
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
      ` : ''}

      <!-- Date (Grants and Works only) -->
      ${this.browseType !== 'expert' ? html`
        <div class="range-filter-container">
          <hr class="search-seperator">
          <div class="collapsible-filter-heading" @click="${() => { this.dateCollapsed = !this.dateCollapsed; }}">
            <h4>Date ${this.browseType === 'grant' ? '(Grants)' : '(Works)'}</h4>
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
      ` : ''}

    </div>

    <!-- ======= MAIN CONTENT ======= -->
    <div class="browse-content">

      <div class="browse-results-heading">
        <ucdlib-browse-az></ucdlib-browse-az>
      </div>

      <!-- Active filter chips -->
      ${this._getActiveFilterCount() > 0 ? html`
        <div class="results-filtered-to">
          ${this.status ? html`
            <p>
              <button class="btn btn--round" @click="${() => this._onStatusChange(this.status)}">
                ${this.status === 'active' ? 'Active' : 'Completed'}
                <div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div>
              </button>
            </p>
          ` : ''}
          ${this.workType ? html`
            <p>
              <button class="btn btn--round" @click="${() => this._onWorkTypeChange(this.workType)}">
                ${this._getWorkTypeLabel(this.workType)}
                <div class="close"><ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon></div>
              </button>
            </p>
          ` : ''}
          ${(this.dept || []).map(code => html`
            <p>
              <button class="btn btn--round" @click="${() => this._removeDeptFilter(code)}">
                ${this._getDeptName(code)}
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

      <div class="browse-results">
        <div class="browse-heading"></div>
        <hr class="browse-seperator">

        <h3>${this.letter === '1' ? '#' : this.letter?.toUpperCase()}</h3>

        ${this.displayedResults.map(
          (result) => html`
            <app-search-result-row
              search-result="${result.position}"
              .result=${result}
              result-type="${this.browseType}"
              hide-checkbox
              hide-search-matches>
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
