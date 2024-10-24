import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { sharedStyles } from '../../styles/shared-styles';

import utils from '../../../lib/utils';

export function render() {
return html`
  <style>
    ${sharedStyles}

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
      background-size: 100% auto;
      background-color: #F2FAF6;
      width: 100%;
      min-height: 12.25rem;
    }

    .hero-text {
      padding: 2.625rem 2.625rem 4.1875rem 2.625rem
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

    .csl-bib-body, .csl-entry {
      display: inline;
      line-height: var(--lh-html);
    }

    .main-content .work h5 {
      color: black;
      margin: 0.5rem 0;
    }

    .work-details .dot {
      padding: 0 0.25rem;
    }

    .work-item ucdlib-icon {
      fill: var(--color-sage);
      margin-top: 0.5rem;
      padding-right: 1rem;
    }

    ucd-theme-pagination {
      padding-bottom: 1rem;
    }

    @media (max-width: 992px) {
      .main-content {
        width: 90%;
      }
    }

    .main-content h2 {
      margin-bottom: 0;
      margin-top: 0;
      color: var(--color-black-60);
    }

  </style>

  <div class="content">
    <div class="hero-main site-frame">
      <div class="hero-text">
        <div class="works">
        <ucdlib-icon icon="ucdlib-experts:fa-user"></ucdlib-icon>
        <span>${this.expertName}</span>
        </div>
        <h1>${this.totalCitations || 0} Works</h1>
      </div>
    </div>

    <div class="main-content">
      <div class="return-to-profile" @click="${this._returnToProfile}">
        <ucdlib-icon icon="ucdlib-experts:fa-circle-chevron-left"></ucdlib-icon>
        <span>RETURN TO PROFILE</span>
      </div>

      ${this.citationsDisplayed.map(
      (cite) => html`
        <h2 style="margin: 1.19rem 0;">${cite.issued?.[0]}</h2>
        <div class="work-item" style="display: flex;">
          <ucdlib-icon class="address-card" icon="ucdlib-experts:fa-book-open"></ucdlib-icon>
          <div class="work">
            <h5>${unsafeHTML(cite.title || cite['container-title'])}</h5>
            <div class="work-details">
              <span style="min-width: fit-content;">${utils.getCitationType(cite.type)}</span>
              <span class="dot">•</span>
              ${unsafeHTML(cite.apa?.replace('(n.d.). ', '')?.replace('(n.d.).', '') || 'Cannot format citation. Contact your <a href="mailto:experts@library.ucdavis.edu">Aggie Experts administrator.</a>')}
            </div>
          </div>
        </div>
        <br>
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
`;}
