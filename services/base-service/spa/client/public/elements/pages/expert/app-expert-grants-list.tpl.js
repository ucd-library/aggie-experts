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
      background: url('/images/watercolor-thiebaud-icing-solid.jpg') no-repeat center center;
      background-size: 100% auto;
      background-color: #F2FAF6;
      width: 100%;
      min-height: 12.25rem;
    }

    .hero-text {
      padding: 2.625rem 2.625rem 4.1875rem 2.625rem
    }

    .hero-text .grants {
      display: flex;
      align-items: center;
    }

    .hero-text .grants ucdlib-icon {
      width: 1rem;
      height: 1rem;
      fill: var(--color-aggie-gold);
    }

    .grants span {
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

    .main-content .grant h5 {
      color: black;
      margin: 0.5rem 0;
    }

    .grant-details .dot {
      padding: 0 0.25rem;
      color: var(--black, #000);
      font-family: Proxima Nova;
      font-size: 1.1875rem;
      font-style: normal;
      font-weight: 700;
      line-height: 1.92125rem;
      text-transform: uppercase;
      position: relative;
      bottom: 0.25rem;
    }

    .grant-item ucdlib-icon {
      fill: var(--color-thiebaud-icing);
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

    .grant-item .grant h5 {
      color: var(--ucd-blue-80, #13639E);
      cursor: pointer;
    }

    .grant-item .grant h5 a {
      text-decoration: none;
    }

  </style>

  <div class="content">
    <div class="hero-main site-frame">
      <div class="hero-text">
        <div class="grants">
        <ucdlib-icon icon="ucdlib-experts:fa-user"></ucdlib-icon>
        <span>${this.expertName}</span>
        </div>
        <h1>${this.totalGrants || 0} Grants</h1>
      </div>
    </div>

    <div class="main-content">
      <div class="return-to-profile" @click="${this._returnToProfile}">
        <ucdlib-icon icon="ucdlib-experts:fa-circle-chevron-left"></ucdlib-icon>
        <span>RETURN TO PROFILE</span>
      </div>


      ${this.grantsActiveDisplayed.map(
      (grant, index) => html`
        <h2 style="margin: 1.19rem 0;"><span ?hidden="${index > 0}">Active</span></h2>
        <div class="grant-item" style="display: flex;">
          <ucdlib-icon class="address-card" icon="ucdlib-experts:fa-file-invoice-dollar"></ucdlib-icon>
          <div class="grant">
            <h5><a href="/grant/${grant['@id']}">${unsafeHTML(grant.name)}</a></h5>
            <div class="grant-details">
              <span style="min-width: fit-content;">${grant.start} - ${grant.end}</span>
              <span class="dot">.</span>
              <span style="min-width: fit-content;">${grant.role}</span>
              <span class="dot">.</span>
              <span style="min-width: fit-content;">Awarded by ${grant.awardedBy}</span>
            </div>
          </div>
        </div>
        <br>
      `
      )}

      ${this.grantsCompletedDisplayed.map(
      (grant, index) => html`
        <h2 style="margin: 1.19rem 0;"><span ?hidden="${index > 0}">Completed</span></h2>
        <div class="grant-item" style="display: flex;">
          <ucdlib-icon class="address-card" icon="ucdlib-experts:fa-file-invoice-dollar"></ucdlib-icon>
          <div class="grant">
            <h5><a href="/grant/${grant['@id']}">${unsafeHTML(grant.name)}</a></h5>
            <div class="grant-details">
              <span style="min-width: fit-content;">${grant.start} - ${grant.end}</span>
              <span class="dot">.</span>
              <span style="min-width: fit-content;">${grant.role}</span>
              <span class="dot">.</span>
              <span style="min-width: fit-content;">Awarded by ${grant.awardedBy}</span>
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
