import { html, css } from 'lit';

import { sharedStyles } from './styles/shared-styles';

export function styles() {
  const elementStyles = css`
    :host {
      display: block;
    }
  `;

  return [
    sharedStyles,
    elementStyles
  ];
}

export function render() {
return html`
  <!--
    Required for AppStateModel
    @ucd-lib/app-state-model imports this element
  -->
  <app-route .appRoutes="${this.appRoutes}"></app-route>

  <ucd-theme-header
    site-name="Aggie Experts"
    prevent-fixed>

    <ucd-theme-primary-nav>
      <a href="/person">Experts</a>
      <!-- <a href="/subject">Subjects</a> -->
      <!-- <a href="/work">Works</a> -->
      <!-- <a href="/grant">Grants</a> -->
    </ucd-theme-primary-nav>

    <ucd-theme-search-popup>
      <ucd-theme-search-form
        @search="${e => console.log(e.detail.searchTerm)}">
      </ucd-theme-search-form>
    </ucd-theme-search-popup>

<!--
    <ucd-theme-quick-links
        title="My Account"
        style-modifiers="highlight"
        @item-click="${e => console.log('@item-click', e.detail)}"
        @toggle="${e => console.log('@toggle', e.detail)}">
      <a href="/auth/login?redirectUrl=/">Login</a>
    </ucd-theme-quick-links> -->

    <ucd-theme-quick-links
        title="Sign In"
        style-modifiers="highlight"
        @item-click="${e => console.log('@item-click', e.detail)}"
        @toggle="${e => console.log('@toggle', e.detail)}">
      <a href="/auth/login?redirectUrl=/">Login</a>
    </ucd-theme-quick-links>


  </ucd-theme-header>
  <div class="main-content">
    <ucdlib-pages
      selected="${this.page}"
      selectedAttribute="visible">
      <div id="loading" ?hidden="${this.page}">
        <img src="/images/logos/logo-icon.svg" style="max-width: 128px" />
        <div class="loading-dots">
          <h1 class="dot one">.</h1>
          <h1 class="dot two">.</h1>
          <h1 class="dot three">.</h1>
        </div>
      </div>
      <app-home id="home"></app-home>
      <!-- <app-work id="work"></app-work> -->
      <app-person id="person"></app-person>
      <!-- <app-grant id="grant"></app-grant> -->
    </ucdlib-pages>
    <div class="footer site-frame">
      <ucdlib-site-footer>
        <ucdlib-site-footer-column header="Aggie Experts">
          <ul>
            <!-- <li><a href="/browse/collections">Collections</a></li>
            <li><a href="/search">Items</a></li>
            <!-- <li><a href="">FAQ</a></li> -->
          </ul>
        </ucdlib-site-footer-column>
        <ucdlib-site-footer-column header="Library Info">
          <ul>
            <li>
              <a
                href="https://library.ucdavis.edu/special-collections/"
                target="_blank"
                rel="noopener"
                >Archives and Special Collections</a
              >
            </li>
            <li>
              <a
                href="https://library.ucdavis.edu/library/"
                target="_blank"
                rel="noopener"
                >Visit the Library</a
              >
            </li>
            <li>
              <a
                href="https://library.ucdavis.edu/news/"
                target="_blank"
                rel="noopener"
                >Library News</a
              >
            </li>
            <li>
              <a
                href="http://give.ucdavis.edu/ULIB"
                target="_blank"
                rel="noopener"
                >Give to the Library</a
              >
            </li>
          </ul>
        </ucdlib-site-footer-column>
        <ucdlib-site-footer-column header="Account">
          <ul>
            <li><app-auth-footer></app-auth-footer></li>
            <li class="fin-admin" ?hidden="${!this.isAdmin}">
              <a href="/fin/admin/${this.pathInfo.length > 1 ? '#path-info' + this.pathInfo : ''}">Fin Admin</a>
            </li>
          </ul>
        </ucdlib-site-footer-column>
        <div insert-into="below-address" ?hidden="${this.showVersion}">
          <div><b>Build Information</b></div>
          <div>App Version: ${this.appVersion}</div>
          <div>Build Time: ${this.localBuildTime}</div>
          <div>Build Number: ${this.buildNum}</div>
          <div>Client Env: ${this.clientEnv}</div>
          <div>Fin App Version: ${this.finAppVersion}</div>
          <div>Fin Branch Name: ${this.finBranchName}</div>
          <div>Fin Repo Tag: ${this.finRepoTag}</div>
          <div>Fin Server Image: ${this.finServerImage}</div>
          <div>Fin Server Repo Hash: ${this.finServerRepoHash}</div>
        </div>
      </ucdlib-site-footer>
    </div>
  </div>
`;}
