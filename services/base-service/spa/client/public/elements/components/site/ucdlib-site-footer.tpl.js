import { html, css } from "lit";

export function styles() {
  const h2MarginBottom = css`var(--spacing-half)`;
  return css`
    :host {
      display: block;
      background-color: var(--color-aggie-blue);
      color: var(--color-white);
      font-size: var(--fs-html);
    }
    a {
      color: var(--color-white);
    }
    .kt {
      white-space: nowrap;
      text-decoration: none;
    }
    .underline {
      text-decoration: underline;
    }
    h2 {
      color: var(--color-white);
      margin-bottom: ${h2MarginBottom};
      margin-top: 0;
      margin-left: var(--spacing-half);
    }
    #lib-logo {
      margin-bottom: ${h2MarginBottom};
      height: 60px;
      min-height: 60px;
      padding-bottom: 1rem;
    }
    #section-columns {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
    }
    #section-columns > * {
      margin: 0 var(--spacing-default) var(--spacing-default);
      margin-right: var(--spacing-default) var(--spacing-default);
      flex-grow: 1;
      margin-bottom: 2rem;
    }
    #section-columns > *:last-child {
      margin-right: 0;
    }
    ucdlib-site-footer-column ul {
      margin: 0;
      padding: 0;
    }
    ucdlib-site-footer-column li:not([hidden]) {
      display: block;
      margin-bottom: 0;
    }
    ucdlib-site-footer-column a,
    ucdlib-site-footer-column span {
      display: block;
      padding: var(--spacing-half);
      padding-left: 0;
    }
    ucdlib-site-footer-column a:hover {
      background-color: var(--color-aggie-blue-80);
      border-radius: 4px;
    }
    .container-footer {
      width: 90%;
      margin: 0 auto;
      padding-top: 4rem;
    }
    .button {
      margin-top: 15px;
    }
    .button > a {
      display: inline !important;
      padding: 8px !important;
      font-weight: var(--fw-bold);
      border: 1px solid white;
      text-decoration: none;
      padding: 8px;
      white-space: normal !important;
      text-align: center;
    }
    .button > a:hover {
      background: var(--color-a-hover);
    }
    address {
      font-style: normal;
    }
    @media (max-width: 1200px) {
      address,
      ucdlib-site-footer-column span {
        font-size: 1rem;
      }
    }
    #below-address {
      margin-top: var(--spacing-default);
    }
    #below-address:empty {
      margin: 0;
    }
    .section-aggie-logo {
      display: flex;
      justify-content: center;
      margin: 1rem 0;
    }
    .container-aggie-logo {
      max-width: 100%;
    }
    .campus-info {
      display: flex;
      align-items: center;
      flex-flow: column wrap;
    }
    .campus-info a {
      text-decoration: underline;
    }
    .campus-info .row {
      margin-bottom: var(--spacing-default);
      display: flex;
    }
    .campus-info a:hover {
      text-decoration: underline;
    }
    .campus-info ul {
      list-style: none;
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      margin: 0;
      padding: 0;
    }
    .campus-info ul li {
      display: inline-block;
    }
    .campus-info ul a.pipe {
      border-right: 1px solid var(--color-aggie-blue-70);
      margin-right: 0.5rem;
      padding-right: 0.5rem;
      line-height: 0.9;
    }
    .campus-info span {
      text-align: center;
    }

    @media (max-width: 992px) {
      #section-columns > * {
        width: 33%;
      }
    }

    @media (max-width: 768px) {
      #section-columns > * {
        width: 100%;
      }
      ucdlib-site-footer-column a {
        padding-left: 0;
      }
      h2 {
        margin-left: 0;
        padding-top: 1.5rem;
      }
      .lib-logo-container {
        padding-top: 1.5rem;
      }
    }
  `;
}

export function render() {
  return html`
    <div class="container container-footer">
      <div id="section-columns" shadow-anchor="section-columns">
        <div id="address-column">
          <div class="lib-logo-container">
            <a href="https://library.ucdavis.edu" target="_blank"
              >${this._renderLibraryLogo()}</a>
          </div>
          <address>
            UC Davis Library <br />
            100 NW Quad <br />
            University of California, Davis <br />
            Davis, CA 95616 <br /><br />
            <a href="tel:+1-530-752-8792" class="underline">530-752-8792</a
            ><br /><br />
            <a href="mailto:experts@ucdavis.edu" class="underline"
              >experts@ucdavis.edu</a>
          </address>
          <div id="below-address" shadow-anchor="below-address"></div>
        </div>
      </div>
      <div class="section-aggie-logo">
        <div class="container-aggie-logo">
          <a href="https://www.ucdavis.edu">${this._renderAggieLogo()}</a>
        </div>
      </div>
      <div class="section-campus-info">${this._renderCampusInfo()}</div>
    </div>
  `;
}
