import { html, css } from 'lit';

import { sharedStyles } from './styles/shared-styles';

export function styles() {
  const elementStyles = css`
    :host {
      display: block;
    }

    [hidden] {
      display: none !important;
    }
  `;

  return [
    sharedStyles,
    elementStyles
  ];
}

export function render() {
return html`
  <style>
    .impersonate-btn {
      margin-left: 1.19rem;
      border-radius: 1.45em;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: auto;
      min-width: 10ch;
      min-height: 2.5em;
      margin-bottom: 0;
      padding: 0.625em 1em;
      border: 1px solid #b0d0ed;
      background-color: transparent;
      color: #022851;
      cursor: pointer;
      font-family: inherit;
      font-weight: 700;
      line-height: 1.1;
      text-align: center;
      text-decoration: none;
      --btn-arrow-color: #ffbf00;
      transition: 0.2s padding ease-out;
      border-color: #ffbf00;
      background-color: transparent;
    }

    .impersonate-btn:hover ucdlib-icon {
      fill: white;
      background-color: #ffbf00;
      border-radius: 50%;
    }

    .impersonate-btn ucdlib-icon {
      margin-left: 0.62rem;
      height: 15px;
      width: 15px;
      min-width: 15px;
      min-height: 15px;
      fill: #ffbf00;
      padding: 3px;
    }

    .impersonate-container {
      position: absolute;
      top: 5rem;
      right: 1rem;
    }

    @media (max-width: 991px) {
      .impersonate-container {
        background-color: white;
        width: 100%;
        right: 0;
        top: 6rem;
        padding: 0.5rem 0;
        display: flex;
        justify-content: end;
        padding-right: 0.5rem;
      }

      .main-content.impersonating {
        padding-top: 3rem;
      }
    }

  </style>
  <!--
    Required for AppStateModel
    @ucd-lib/app-state-model imports this element
  -->
  <app-route .appRoutes="${this.appRoutes}"></app-route>

  <ucd-theme-header
    site-name="Aggie Experts"
    figure-src="/images/aggie-experts-logo-primary.png"
    prevent-fixed>

    <ucd-theme-primary-nav>
      <a href="/browse/expert">Experts</a>
      <!-- <a href="/subject">Subjects</a> -->
      <!-- <a href="/work">Works</a> -->
      <!-- <a href="/grant">Grants</a> -->
    </ucd-theme-primary-nav>

    <ucd-theme-search-popup>
      <ucd-theme-search-form
        @search="${this._onSearch}">
      </ucd-theme-search-form>
    </ucd-theme-search-popup>

    <ucd-theme-quick-links
        title="My Account"
        style-modifiers="highlight"
        @item-click="${e => console.log('@item-click', e.detail)}"
        @toggle="${e => console.log('@toggle', e.detail)}">
      <a href="/${this.expertId}">Profile</a>
      <a href="/faq">Help</a>
      <a href="/auth/logout">Log Out</a>
      <a href="https://org.ucdavis.edu/odr/">UC Davis Online Directory Listing</a>
      <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management</a>
    </ucd-theme-quick-links>

  </ucd-theme-header>

  <div ?hidden="${this.hideImpersonate}" class="impersonate-container">
    <button @click="${this._cancelImpersonateClick}" class="impersonate-btn">
      ${this.expertNameImpersonating}
      <div id="close">
        <ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>
      </div>
    </button>
  </div>

  <div class="main-content ${this.hideImpersonate ? '' : 'impersonating'}">
    <ucdlib-pages
      selected="${this.page}"
      selectedAttribute="visible">
      <app-home id="home"></app-home>
      <app-browse id="browse"></app-browse>
      <!-- <app-work id="work"></app-work> -->
      <app-expert @impersonate="${this._impersonateClick}" id="expert" @show-404="${(e) => this.page = '404'}"></app-expert>
      <app-expert-works-list id="works" @show-404="${(e) => this.page = '404'}"></app-expert-works-list>
      <app-expert-works-list-edit id="works-edit" @show-404="${(e) => this.page = '404'}"></app-expert-works-list-edit>
      <app-expert-grants-list id="grants" @show-404="${(e) => this.page = '404'}"></app-expert-grants-list>
      <app-expert-grants-list-edit id="grants-edit" @show-404="${(e) => this.page = '404'}"></app-expert-grants-list-edit>
      <app-search id="search"></app-search>
      <app-faq id="faq"></app-faq>
      <app-tou id="termsofuse"></app-tou>
    </ucdlib-pages>

    <app-404 id="404" ?hidden="${this.page !== '404'}"></app-404>

    <div class="footer site-frame">
      <ucdlib-site-footer>
        <ucdlib-site-footer-column header="Need Help?">
          <ul>
            <li>
              <a
                href="/faq"
                rel="noopener"
                >Frequently Asked Questions</a>
            </li>
            <li>
              <a
                href="https://github.com/ucd-library/aggie-experts-public-issues/issues/new/choose"
                target="_blank"
                rel="noopener"
                >Report Issue</a>
            </li>
            <li>
              <a
                href="mailto:experts@library.ucdavis.edu"
                rel="noopener"
                >Contact Us</a>
            </li>
          </ul>
        </ucdlib-site-footer-column>
        <ucdlib-site-footer-column header="Terms of Use">
          <ul>
            <li>Our sources use algorithms for matching publications to people. Errors may exist.</li>
            <li>
              <a
                href="/termsofuse"
                rel="noopener"
                >Terms of Use</a>
            </li>
          </ul>
        </ucdlib-site-footer-column>
        <ucdlib-site-footer-column header="Copyright">
          <ul>
            <li>©2023 The Regents of the University of California, Davis</li>
          </ul>
        </ucdlib-site-footer-column>
      </ucdlib-site-footer>
    </div>
  </div>
`;}
