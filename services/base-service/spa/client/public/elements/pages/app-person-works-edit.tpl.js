import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

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
      height: 12.25rem;
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
      color: var(--color-aggie-blue-80);
      margin: 0 0 0.5rem 0;
    }

    .work-details .dot {
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
      width: 135px;
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

    h3 {
      margin: 1.19rem 0;
    }

    h3.first {
      margin-top: 0;
    }

    @media (max-width: 992px) {
      .main-content {
        width: 90%;
      }
    }

  </style>

  <div class="content">
    <div class="hero-main site-frame">
      <div class="hero-text">
        <div class="works">
        <ucdlib-icon icon="ucdlib-experts:fa-user"></ucdlib-icon>
        <span>${this.personName}</span>
        </div>
        <h1>Manage My Works (${this.citations.length || 0})</h1>
      </div>
    </div>

    <div class="main-content">
      <div class="return-to-profile" @click="${this._returnToProfile}">
        <ucdlib-icon icon="ucdlib-experts:fa-circle-chevron-left"></ucdlib-icon>
        <span>RETURN TO PROFILE</span>
      </div>

      <div style="display: flex; flex-direction: row-reverse;">
        <button class="btn btn--invert" @click="${this._downloadClicked}">Download</button>
      </div>

      <div class="works-results" style="padding-bottom: 2.5rem;">
        <div class="select-all">
          <label for="select-all">Select All</label>
          <input type="checkbox" id="select-all" name="select-all" value="select-all" @click="${this._selectAllChecked}">
        </div>

        ${this.citationsDisplayed.map(
        (cite, index) => html`
          <h3 class="${index === 0 || index % 20 === 0 ? 'first' : ''}">${cite.issued?.['date-parts']?.[0]}</h3>
          <hr class="work-seperator">
          <div style="display: flex; justify-content: space-between;">
            <div class="hide-delete-btn-group">
              <ucdlib-icon icon="ucdlib-experts:fa-eye-slash"></ucdlib-icon>
              <ucdlib-icon icon="ucdlib-experts:fa-trash"></ucdlib-icon>
            </div>
            <div class="work">
              <h5>${unsafeHTML(cite.title)}</h5>
              <div class="work-details">
                <span style="min-width: fit-content;">${cite.type}</span>
                <span class="dot">.</span>
                ${unsafeHTML(cite.apa)}
              </div>
            </div>
            <div class="select-checkbox">
              <input type="checkbox" id="select-${index}" name="select-${index}" value="select-${index}" @click="${this._selectChecked}">
            </div>
          </div>
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

  </div>
`;}
