import { html, css } from 'lit';


export function styles() {
  const elementStyles = css`
    :host {
      display: block;
    }
  `;

  return [
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
      <a href=#>People</a>
      <a href="#">Subjects</a>
      <a href="#">Works</a>
      <a href="#">Grants</a>
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
    <app-work id="work"></app-work>
    <app-person id="person"></app-person>
    <app-grant id="grant"></app-grant>
  </ucdlib-pages>
</div>

`;}
