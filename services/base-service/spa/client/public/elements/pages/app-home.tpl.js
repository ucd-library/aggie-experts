import { html } from 'lit';

export function render() {
return html`
  <style>
    :host {
      display: block;
    }

    .hero-main {
      background: url('../images/ae-header.png');
      width: 100%;
      min-height: 500px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background-position: bottom;
      background-repeat: no-repeat;
      background-size: cover;
    }

    .color-light {
      color: white;

      /* TODO move styles to common import */
      font-size: 1.78rem;
    }

    h1 {
      /* TODO move styles to common import */
      color: #FFBF00;  /* ucd-gold-100 */
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .content {
      width: 80%;
      margin: 0 auto;
    }
  </style>

  <div class="hero-main site-frame">
    <div class="content">
      <h1>Discover Academic Excellence</h1>
      <div class="sub-heading h4 color-light">
        Aggie Experts facilitates expert collaboration and research discovery across all disciplines at UC Davis.
      </div>
      <app-search-box
        id="searchBox"
        @search="${this._onSearch}"
        placeholder="search">
        <!-- <iron-icon icon="fin-icons:search" class="search-icon" slot="button-content"></iron-icon> -->

      </app-search-box>

      <div style="padding-top: 1.5rem;">
        <a href="/fcrepo/rest" style="color: white;">Explore Fedora</a> <span style="color: white; padding-left: 0.3rem"> (must be signed in)</span>

      </div>
    </div>
  </div>



`;}
