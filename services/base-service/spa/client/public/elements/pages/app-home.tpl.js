import { html } from 'lit';

import { sharedStyles } from '../styles/shared-styles';

export function render() {
return html`
  <style>
    ${sharedStyles}
    :host {
      display: block;
    }

    .hero-main {
      background: url('/images/ae-watercolor-feature.jpg');
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
    }

    h1 {
      color: var(--color-aggie-gold);
      margin-bottom: 0.5rem;
    }

    .content {
      width: 80%;
      margin: 0 auto;
    }

    .content h1 {
      padding-top: 2rem;
    }

    .content .sub-heading {
      font-size: 1.7rem;
    }

    .content.flex {
      display: flex;
      align-items: center;
      margin-top: 4rem;
      margin-bottom: 4rem;
    }

    app-search-box {
      max-width: 600px;
      padding-top: 2rem;
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
      </app-search-box>
    </div>
  </div>
  <div class="site-frame">
    <div class="content flex">
      <div class="stub" style="background-color: #C4C4C4; height: 400px; width: 50%"></div>
      <div class="sub-heading h4" style="padding: 2rem; width: 50%">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin ac nulla ex.
      </div>
    </div>
  </div>
`;}
