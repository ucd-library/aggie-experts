import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { sharedStyles } from '../../styles/shared-styles';

import buttonsCss from "@ucd-lib/theme-sass/2_base_class/_buttons.css";

import utils from '../../../lib/utils';

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

    .csl-bib-body, .csl-entry {
      display: inline;
      line-height: var(--lh-html);
    }

    .main-content .work {
      max-width: calc(90vw - 100px);
    }

    .main-content .work h5 {
      color: black;
      margin: 0 0 0.5rem 0;
      font-size: 1.2rem;
      line-height: 1.3;
    }

    .work-details .dot {
      padding: 0 0.25rem;
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

    .work-seperator {
      display: block;
      height: 1px;
      border: 0;
      border-top: 1px solid var(--color-aggie-blue-40);
      padding: 0;
      margin: 1.19rem 0;
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
      float: right;
      padding-top: 1rem;
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

    .hide-delete-btn-group {
      display: flex;
      align-items: flex-start;
      padding-top: .25rem;
    }

    .hide-delete-btn-group ucdlib-icon {
      fill: var(--color-aggie-blue-80);
      width: 15px;
      height: 15px;
      min-width: 17px;
      min-height: 17px;
      padding-right: .89rem;
      cursor: pointer;
    }

    .hide-delete-btn-group ucdlib-icon:hover {
      fill: var(--color-aggie-gold);
    }

    h2 {
      margin: 1.19rem 0;
    }

    h2.first {
      margin-top: 0;
      padding-top: 1.19rem;
    }

    .tooltip {
      cursor: pointer;
    }

    .tooltip:before {
      content: attr(data-text);
      position: absolute;
      bottom: 27px;
      right: -27px;

      width: 90px;
      padding: 2px 10px;
      border-radius: 7px;
      background: #000;
      color: #fff;
      text-align: center;
      font-size: .8rem;
      font-weight: bold;

      opacity: 0;
      transition: .2s opacity ease-out;
    }

    .tooltip:after {
      content: "";
      position: absolute;
      bottom: 17px;
      right: 23px;

      border: 5px solid #000;
      border-color: black transparent transparent transparent;

      opacity: 0;
      transition: .2s opacity ease-out;
    }

    .tooltip:hover:before, .tooltip:hover:after {
      opacity: 1;
    }

    .tooltip.reject-work:before {
      right: -25px;
    }

    .tooltip.reject-work:after {
      right: 21px;
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

    .not-visible h5,
    .not-visible .work-details {
      font-style: italic;
    }

    .main-content .not-visible .work h5 {
      color: var(--ucd-black-60, #7F7F7F);
    }

    .not-visible .work-details {
      color: var(--ucd-black-50, #999);
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

    .works-results > div {
      flex-shrink: 1;
      word-wrap: break-word;
    }

    .works-results .work h5 {
      color: var(--ucd-blue-80, #13639E);
      cursor: pointer;
    }

    .works-results .work h5 a {
      text-decoration: none;
    }

    /* styles for collapsed dropdown */
    .custom-collapse {
      --collapse-background-color: #FFFBED;
      --collapse-border-color: #FFBF00;
      padding: 1.19rem 0;
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
                  <h5 data-id=${work['@id']}>${work.issued.split('-')?.[0]}
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

      <div style="display: flex; flex-direction: row-reverse;">
        <button class="btn btn--invert" @click="${this._downloadClicked}">Download</button>
      </div>

      <div class="works-results" style="padding-bottom: 2.5rem;">
        <div class="select-all">
          <label for="select-all">Select All</label>
          <input type="checkbox" id="select-all" name="select-all" value="select-all" ?checked="${this.allSelected}" @click="${this._selectAllChecked}">
        </div>

        ${this.citationsDisplayed.map(
        (cite, index) => html`
          <h2 class="${index === 0 || index % this.resultsPerPage === 0 ? 'first' : ''}">${cite.issued?.[0]}</h2>
          <hr class="work-seperator">
          <div style="display: flex; justify-content: space-between; margin: 1.19rem 0;" class="${!cite['is-visible'] ? 'not-visible' : ''}">
            <div class="hide-delete-btn-group">
              <span style="position: relative;">
                <span class="tooltip hide-work" data-text="Hide work">
                  <ucdlib-icon
                    ?hidden="${!cite['is-visible']}"
                    icon="ucdlib-experts:fa-eye"
                    @click=${this._hideWork}
                    @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') this._hideWork(e); }}
                    tabindex="0"
                    role="button"
                    aria-label="Hide work"
                    data-id="${cite.relatedBy?.[0]?.['@id']}"></ucdlib-icon>
                </span>
                <span class="tooltip show-work" data-text="Show work">
                  <ucdlib-icon
                    ?hidden="${cite['is-visible']}"
                    icon="ucdlib-experts:fa-eye-slash"
                    @click=${this._showWork}
                    @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') this._showWork(e); }}
                    tabindex="0"
                    role="button"
                    aria-label="Show work"
                    data-id="${cite.relatedBy?.[0]?.['@id']}"></ucdlib-icon>
                </span>
              </span>
              <span style="position: relative;">
                <span class="tooltip reject-work" data-text="Reject work">
                  <ucdlib-icon
                    icon="ucdlib-experts:fa-trash"
                    @click=${this._rejectWork}
                    @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') this._rejectWork(e); }}
                    tabindex="0"
                    role="button"
                    aria-label="Reject work"
                    data-id="${cite.relatedBy?.[0]?.['@id']}"></ucdlib-icon>
                </span>
              </span>
            </div>
            <div class="work">
              <h5><a href="/work/${cite['@id']}">${unsafeHTML(cite.title || cite['container-title'])}</a></h5>
              <div class="work-details">
                <span style="min-width: fit-content;">${utils.getCitationType(cite.type)}</span>
                <span class="dot">•</span>
                ${unsafeHTML(cite.apa?.replace('(n.d.). ', '')?.replace('(n.d.).', '') || 'Cannot format citation. Contact your <a href="mailto:experts@library.ucdavis.edu">Aggie Experts administrator.</a>')}
              </div>
            </div>
            <div class="select-checkbox">
              <input type="checkbox" data-id="${cite['@id']}" id="select-${index}" name="select-${index}" value="select-${index}" @click="${this._selectChecked}">
            </div>
          </div>
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
