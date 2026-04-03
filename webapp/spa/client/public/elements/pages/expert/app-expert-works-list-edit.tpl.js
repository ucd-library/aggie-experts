import { html } from 'lit';

import { sharedStyles } from '../../styles/shared-styles';

import buttonsCss from "@ucd-lib/theme-sass/2_base_class/_buttons.css";

import '../../components/edit-work-result-row.js';


export function render() {
return html`
  <style>
    ${sharedStyles}
    ${buttonsCss}

    :host {
      display: block;
    }

    h1 {
      margin-top: 0.5rem;
      margin-bottom: 0;
      padding-bottom: 0;
      color: var(--color-aggie-blue);
    }

    .hero-main {
      background: url('/images/watercolor-sage-solid.jpg') no-repeat center center;
      background-size: cover;
      background-color: #F2FAF6;
      width: 100%;
    }

    .hero-text {
      padding: 2.625rem;
    }

    .hero-text .works {
      display: flex;
      align-items: center;
    }

    .hero-text .works ucdlib-icon {
      width: 1rem;
      height: 1rem;
      fill: var(--color-aggie-gold);
    }

    .works span {
      color: var(--color-black-60);
      padding-left: 0.5rem;
      font-size: 1rem;
      font-weight: bold;
      text-transform: uppercase;
    }

    .return-to-profile {
      display: flex;
      align-items: center;
      cursor: pointer;
      padding-bottom: 2.38rem;
    }

    .return-to-profile ucdlib-icon {
      fill: var(--color-aggie-gold);
    }

    .return-to-profile span {
      padding-left: 0.5rem;
      font-weight: bold;
      color: var(--color-aggie-blue-80);
    }

    .main-content {
      width: 53.5rem;
      margin: 0 auto;
      padding-top: 2.38rem;
    }

    .main-content h2 {
      margin-bottom: 0;
      margin-top: 0;
      color: var(--color-black-60);
    }

    ucd-theme-pagination {
      padding-top: 1.5rem;
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

    .work-seperator,
    .max-highlights-warning {
      display: block;
      height: 1px;
      border: 0;
      border-top: 1px solid var(--color-aggie-blue-40);
      padding: 0;
      margin: 1.19rem 0;
    }

    .max-highlights-warning {
      border-top: 1px solid var(--color-aggie-gold, #FFBF00);
      margin: 0;
    }

    input[type="checkbox"] {
      height: 1rem;
      width: 1rem;
    }

    .select-all,
    .select-checkbox {
      display: flex;
      flex-direction: row-reverse;
      align-items: center;
      padding-top: 1.2rem;
    }

    .select-all {
      display: inline-block;
      padding-top: 0;
    }

    .select-checkbox {
      align-items: flex-start;
      padding-top: 0;
      padding-left: .89rem;
      margin-left: auto;
    }

    .select-all label {
      color: var(--other-h-3-gray, #666);
      font-size: .95rem;
      font-style: normal;
      font-weight: 400;
      line-height: 1.625rem;
      padding-right: .4rem;
      position: relative;
      bottom: .2rem;
    }

    h2 {
      margin: 1.19rem 0;
    }

    h2.first {
      margin-top: 0;
      padding-top: 1.19rem;
    }

    @media (max-width: 992px) {
      .main-content {
        width: 90%;
      }
    }

    @media (max-width: 375px) {
      .hero-main {
        background-size: auto 100%;
      }
    }

    .hero-main button.btn.add-work {
      font-size: .85rem;
      margin: .85rem 0;
    }

    .hero-main button.btn.add-work::before {
      padding: 0 .4rem;
      opacity: 1;
      transform: initial;
      transition: initial;

      content: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20448%20512%22%3E%3C!--!Font%20Awesome%20Free%206.5.1%20by%20%40fontawesome%20-%20https%3A%2F%2Ffontawesome.com%20License%20-%20https%3A%2F%2Ffontawesome.com%2Flicense%2Ffree%20Copyright%202024%20Fonticons%2C%20Inc.--%3E%3Cpath%20d%3D%22M416%20208H272V64c0-17.7-14.3-32-32-32h-32c-17.7%200-32%2014.3-32%2032v144H32c-17.7%200-32%2014.3-32%2032v32c0%2017.7%2014.3%2032%2032%2032h144v144c0%2017.7%2014.3%2032%2032%2032h32c17.7%200%2032-14.3%2032-32V304h144c17.7%200%2032-14.3%2032-32v-32c0-17.7-14.3-32-32-32z%22%20fill%3D%22%23FFBF00%22%2F%3E%3C%2Fsvg%3E");
    }

    .hero-main button.btn.add-work:hover {
      padding-right: 1.5em;
      padding-left: 0.75em;
    }

    /* styles for collapsed dropdown */
    .custom-collapse {
      --collapse-background-color: #FFFBED;
      --collapse-border-color: #FFBF00;
      padding: 1.19rem 0;
    }

    .works-results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 0.5rem;
      margin-bottom: 1rem;
    }

    .highlights-instructions {
      color: var(--ucd-black-70, #4C4C4C);
      font-size: 1rem;
      font-style: italic;
      font-weight: 400;
      line-height: 1.625rem;
      margin: 0;
    }

    @media (max-width: 778px) {
      .highlights-instructions {
        max-width: 60vw;
      }
    }

    .highlights-results .no-works {
      color: var(--black, #000);
      font-size: 1rem;
      font-style: normal;
      font-weight: 400;
      line-height: 1.6625rem;
    }

    .max-highlights-warning-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      background-color: var(--color-aggie-gold-20, #FFF9E6);
    }

    .max-highlights-warning-row ucdlib-icon {
      width: 50px;
      height: 50px;
      fill: var(--color-aggie-gold);
      margin: 0 0.5rem;
    }

    .max-highlights-warning-row .highlights-instructions {
      color: var(--black, #000);
      font-size: 1rem;
      font-style: italic;
      font-weight: 700;
      line-height: 1.625rem;
      margin-right: .5rem;
    }

    .show-all-highlights-toggle {
      cursor: pointer;
    }

    .show-all-highlights-toggle .expand,
    .show-all-highlights-toggle .collapse {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: var(--color-aggie-blue-80, #13639E);
      font-style: normal;
      font-weight: 600;
      line-height: normal;
      font-size: 0.875rem;
    }

    /* wrappers for animated expand/collapse */
    .row-wrapper {
      transition: height 600ms cubic-bezier(.2,.9,.2,1), opacity 300ms ease;
      will-change: height, opacity;
    }
    .row-wrapper.collapsed {
      height: 0 !important;
      opacity: 0;
      pointer-events: none;
    }
    .row-wrapper:not(.collapsed) {
      opacity: 1;
    }

  </style>

  <div class="content">
    <app-modal-overlay
      ?hidden="${!this.showModal}"
      .visible="${this.showModal}"
      .title="${this.modalTitle}"
      .content="${this.modalContent}"
      .hideCancel="${this.hideCancel}"
      .hideSave="${this.hideSave}"
      .hideOK="${this.hideOK}"
      .hideOaPolicyLink="${this.hideOaPolicyLink}"
      .errorMode="${this.errorMode}"
      @cancel=${(e) => this.showModal = false}
      @save=${this._modalSave}>
    </app-modal-overlay>
    <div class="hero-main site-frame">
      <div class="hero-text">
        <div class="works">
        <ucdlib-icon icon="ucdlib-experts:fa-user"></ucdlib-icon>
        <span>${this.expertName}</span>
        </div>
        <h1>${this.manageWorksLabel}</h1>
        <button class="btn btn--round btn--alt2 add-work" @click="${this._addNewWorkClicked}">Add New Work</button>
      </div>
    </div>

    <div class="main-content">
      <div
        class="return-to-profile"
        @click="${this._returnToProfile}"
        @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') this._returnToProfile(e); }}
        tabindex="0"
        role="button"
        aria-label="Return to profile">
        <ucdlib-icon icon="ucdlib-experts:fa-circle-chevron-left"></ucdlib-icon>
        <span>RETURN TO PROFILE</span>
      </div>

      <div class="custom-collapse" ?hidden="${this.worksWithErrors.length === 0}">
        <ucd-theme-collapse brand-class="category-brand--secondary" title="Works with Errors (${this.worksWithErrors.length})">

          ${this.worksWithErrors.map(
            (work, index) => html`
              <div style="display: flex; justify-content: space-between; margin: ${index === 0 ? '0' : '1.19rem'} 0 ${index+1 === this.worksWithErrors.length ? '0' : '1.19rem'};">
                <div class="work">
                  <h5 data-id=${work['@id']}>${work.issued?.split('-')?.[0]}
                    <span style="padding: 0 0.25rem;"
                    class="dot">•</span> ${work.title}</h5>
                  <p style="margin-bottom: 0;">Error: Cannot format citation. Contact your <a href="mailto:experts@library.ucdavis.edu">Aggie Experts administrator.</a></p>
                </div>
              </div>
              <hr style="border-color: #CCE0F3;" ?hidden=${index+1 === this.worksWithErrors.length}>
            `)
          }

        </ucd-theme-collapse>
      </div>

      <div class="works-results-header">
        <div>
          <h2 ?hidden="${this.currentPage > 1}">Highlights (${this.featuredCitations.length})</h2>
        </div>
        <button class="btn btn--invert" @click="${this._downloadClicked}">Download</button>
      </div>
      <div class="works-results-header">
        <div>
          <p ?hidden="${this.currentPage > 1}" class="highlights-instructions">Click the heart icon beside a work to add or remove it from your profile Highlights.</p>
        </div>
        <div class="select-all">
          <label for="select-all">Select All</label>
          <input type="checkbox" id="select-all" name="select-all" value="select-all" ?checked="${this.allSelected}" @click="${this._selectAllChecked}">
        </div>
      </div>

      <div class="highlights-results" ?hidden="${this.currentPage > 1}">
        ${this.featuredCitations.map(
          (cite, index) => html`
            ${index === this.maxFeaturedCitationsIndex ? html`
              <hr class="max-highlights-warning" ?hidden="${!this.showingAllHighlights && index > 4}">
              <div class="max-highlights-warning-row" ?hidden="${!this.showingAllHighlights && index > 4}">
                <ucdlib-icon icon="ucdlib-experts:fa-exclamation-triangle"></ucdlib-icon>
                <p class="highlights-instructions">
                  A maximum of 10 highlights will appear on your profile. These additional highlights will remain in your full
                  works list but will not be shown in the Highlights section:
                </p>
              </div>
              <hr class="max-highlights-warning" ?hidden="${!this.showingAllHighlights && index > 4}">
            ` : html`<hr class="work-seperator" ?hidden="${!this.showingAllHighlights && index > 4}" style="margin-top: ${index === 0 ? '0' : '1.19rem'};">`}

            <div class="row-wrapper ${!this.showingAllHighlights && index > 4 ? 'collapsed' : ''}" data-index="${index}">
              <edit-work-result-row
                .cite="${cite}"
                .index="${index}"
                .expertId="${this.expertId}"
                .showYear="${true}"
                @deselect-favourite="${this._deselectFavourite}"
                @mark-favourite="${this._markFavourite}"
                @hide-work="${this._hideWork}"
                @show-work="${this._showWork}"
                @reject-work="${this._rejectWork}"
                @select-checked="${this._selectChecked}">
              </edit-work-result-row>
            </div>
          `
          )}

        <hr class="work-seperator" ?hidden="${this.featuredCitations.length <= 5}">
        <div class="show-all-highlights-toggle" ?hidden="${this.featuredCitations.length <= 5}">
          <div class="expand"
            ?hidden="${this.showingAllHighlights}"
            @click="${this._toggleShowAllHighlights}">
            <span>Show All Highlights</span>
            <ucdlib-icon icon="ucdlib-experts:fa-chevron-down"></ucdlib-icon>
          </div>
          <div class="collapse"
            ?hidden="${!this.showingAllHighlights}"
            @click="${this._toggleShowAllHighlights}">
            <span>Show Fewer Highlights</span>
            <ucdlib-icon icon="ucdlib-experts:fa-chevron-up"></ucdlib-icon>
          </div>
        </div>

        <hr class="work-seperator" style="margin-bottom: 0.62rem;" ?hidden="${this.featuredCitations.length > 0}">
        <p class="no-works" ?hidden="${this.featuredCitations.length > 0}">No works highlighted</p>

      </div>

      <h2 ?hidden="${this.currentPage > 1}" style="margin-top: 2.38rem;">All Works</h2>
      <div class="works-results" style="padding-bottom: 2.5rem;">
        ${this.citationsDisplayed.map(
        (cite, index) => html`
          <h4 style="margin-top: 1rem;" class="${index === 0 || index % this.resultsPerPage === 0 ? 'first' : ''}">${cite.issued?.[0]}</h4>
          <hr class="work-seperator">
          <edit-work-result-row
            .cite="${cite}"
            .index="${index}"
            .expertId="${this.expertId}"
            @deselect-favourite="${this._deselectFavourite}"
            @mark-favourite="${this._markFavourite}"
            @hide-work="${this._hideWork}"
            @show-work="${this._showWork}"
            @reject-work="${this._rejectWork}"
            @select-checked="${this._selectChecked}">
          </edit-work-result-row>
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

<app-toast-popup></app-toast-popup>
`;}
