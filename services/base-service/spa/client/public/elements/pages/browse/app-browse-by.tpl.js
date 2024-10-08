import { html } from 'lit';

import { sharedStyles } from '../../styles/shared-styles';

export function render() {
return html`
  <style>
    ${sharedStyles}

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

    .browse-content {
      display: block;
      width: 53.5rem;
      padding: 3rem 0rem 4.1875rem 0rem;
      margin: 0 auto;
    }

    .browse-results-heading {
      padding-top: .8rem;
    }

    .browse-seperator {
      display: block;
      height: 1px;
      border: 0;
      border-top: 4px dotted var(--color-aggie-gold);
      padding: 0;
      margin: 1.19rem 0;
    }

    .search-seperator {
      display: block;
      height: 1px;
      border: 0;
      border-top: 1px solid var(--color-aggie-blue-40);
      padding: 0;
      margin: 1.19rem 0;
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

    .browse-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    h3 {
      font-size: 2.49375rem;
      margin: 0.5rem 0 1rem;
    }

    @media (max-width: 992px) {
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
        background-color: #FFBF00;
      }
    }
  </style>

  <div class="browse-header">
    <div class="browse-label">Experts</div>
    <div class="color-border" style="display: flex; height: 75px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none">
        <path d="M21.6 0L0 89H24V0H21.6Z" fill="#FFBF00"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none" style="position: relative; left: -1px">
        <path d="M2.4 89L24 0H0V89H2.4Z" fill="#FFBF00"/>
      </svg>
    </div>
  </div>

  <div class="browse-content">

    <div class="browse-results-heading">

      <ucdlib-browse-az></ucdlib-browse-az>

    </div>

    <div class="browse-results">
      <div class="browse-heading">

      </div>
      <hr class="browse-seperator">

      <h3>${this.id.toUpperCase()}</h3>

      ${this.displayedResults.map(
        (result) => html`
          <app-search-result-row search-result="${result.position}" .result=${result} hide-checkbox hide-search-matches></app-search-result-row>
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

`;}
