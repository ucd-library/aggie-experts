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
    .edit-expert-btn {
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
      background-color: white;
    }

    .edit-expert-btn:hover ucdlib-icon {
      fill: white;
      background-color: #ffbf00;
      border-radius: 50%;
    }

    .edit-expert-btn ucdlib-icon {
      margin-left: 0.62rem;
      height: 15px;
      width: 15px;
      min-width: 15px;
      min-height: 15px;
      fill: #ffbf00;
      padding: 3px;
    }

    .edit-expert-container {
      position: absolute;
      top: 5rem;
      right: 1rem;
    }

    .edit-expert-container.collapse {
      background-color: white;
      width: 100%;
      right: 0;
      top: 10.75rem;
      padding: 0.5rem 0;
      display: flex;
      justify-content: end;
      padding-right: 0.5rem;
    }

    .main-content.editing.collapse {
      padding-top: 3rem;
    }

    .spinner-container {
      position: fixed;
      top: calc(50% + 15px);
      left: calc(50% - 70px);
      height: 100px;
      color: var(--color-aggie-blue);
    }

    .spinner {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color:  transparent;
      transition: opacity 0.75s, visibility 0.75s;
    }

    .spinner:after {
      content: '';
      width: 40px;
      height: 40px;
      border: 5px solid  var(--color-aggie-gold-70);
      border-top-color: var(--color-aggie-gold);
      border-radius: 50%;
      animation: loading 0.75s ease infinite;
    }

    .overlay {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      background: rgba(255, 255, 255, .6);
    }

    @keyframes loading {
      from {
        transform: rotate(0turn);
      }
      to {
        transform: rotate(1turn);
      }
    }

    ucdlib-pages.loading {
      opacity: .6;
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
      <a href="/browse/grant">Grants</a>
    </ucd-theme-primary-nav>

    <ucd-theme-search-popup>
      <ucd-theme-search-form
        @search="${this._onSearch}">
      </ucd-theme-search-form>
    </ucd-theme-search-popup>

    <ucd-theme-quick-links
        title="My Account"
        style-modifiers="highlight"
        use-icon>
      <svg slot="custom-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>
      <a href="/${this.expertId}">Profile</a>
      <a href="/faq">Help</a>
      <a href="/auth/logout">Log Out</a>
      <a href="https://org.ucdavis.edu/odr/">UC Davis Online Directory Listing</a>
      <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management</a>
    </ucd-theme-quick-links>

  </ucd-theme-header>

  <div ?hidden="${this.hideEdit}" class="edit-expert-container">
    <button @click="${this._cancelEditExpertClick}" class="edit-expert-btn">
      ${this.expertNameEditing}
      <div id="close">
        <ucdlib-icon icon="ucdlib-experts:fa-times"></ucdlib-icon>
      </div>
    </button>
  </div>

  <div class="main-content">
    <ucdlib-pages
      selected="${this.page}"
      selectedAttribute="visible"
      class="${this.loading ? 'loading' : ''}">
      <app-home id="home"></app-home>
      <app-browse id="browse"></app-browse>
      <!-- <app-work id="work"></app-work> -->
      <app-expert
        @loading="${(e) => this.loading = true}"
        @loaded="${(e) => this.loading = false}"
        @cancel-edit-expert="${this._editExpertClick}"
        id="expert"
        @show-404="${(e) => this.page = '404'}">
      </app-expert>
      <app-expert-works-list id="works" @show-404="${(e) => this.page = '404'}"></app-expert-works-list>
      <app-expert-works-list-edit
        @loading="${(e) => this.loading = true}"
        @loaded="${(e) => this.loading = false}"
        id="works-edit"
        @show-404="${(e) => this.page = '404'}">
      </app-expert-works-list-edit>
      <app-grant id="grant" @show-404="${(e) => this.page = '404'}"></app-grant>
      <app-work id="work" @show-404="${(e) => this.page = '404'}"></app-work>
      <app-expert-grants-list id="grants" @show-404="${(e) => this.page = '404'}"></app-expert-grants-list>
      <app-expert-grants-list-edit
        @loading="${(e) => this.loading = true}"
        @loaded="${(e) => this.loading = false}"
        id="grants-edit"
        @show-404="${(e) => this.page = '404'}">
      </app-expert-grants-list-edit>
      <app-search id="search"></app-search>
      <app-faq id="faq"></app-faq>
      <app-tou id="termsofuse"></app-tou>
    </ucdlib-pages>

    <app-404 id="404" ?hidden="${this.page !== '404'}"></app-404>

    <div class="overlay" ?hidden="${!this.loading}">
      <div class="spinner-container" ?hidden="${!this.loading}">
        <div ?hidden="${!this.loading}" class="spinner"></div>
        <h3>Saving Changes</h3>
      </div>
    </div>

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
            <li>&copy;2024 The Regents of the University of California, Davis</li>
          </ul>
        </ucdlib-site-footer-column>
      </ucdlib-site-footer>
    </div>
  </div>
`;}
