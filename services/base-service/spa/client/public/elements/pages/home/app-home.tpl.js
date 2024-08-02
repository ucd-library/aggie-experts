import { html } from 'lit';

import { sharedStyles } from '../../styles/shared-styles';

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
      /* min-height: 500px; */
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
      padding-bottom: 8rem;
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
      margin-top: 2rem;
      margin-bottom: 2rem;
      width: 90%;
      padding-bottom: 2rem;
    }

    app-search-box {
      max-width: 600px;
      padding-top: 2rem;
    }

    .sub-heading.quote {
      padding: 2rem 1rem 2rem 2rem;
      width: 50%;
    }

    img.research-trio {
      width: 50%;
    }

    .quote-text {
      color: var(--ucd-blue-80, #13639E);
      font-size: 2rem;
      font-style: normal;
      font-weight: 700;
      line-height: 2.7rem;
      display: block;
      padding-bottom: .65rem;
    }

    .quote-author {
      color: var(--other-h3-gray, #666);
      font-size: 1.7rem;
      font-style: italic;
      font-weight: 600;
      line-height: 2.48313rem; /* 119.994% */
    }

    .tooltip {
      cursor: pointer;
    }

    .tooltip:hover:before,
    .tooltip.clicked:before {
      content: attr(data-text);
      position: absolute;
      bottom: -25px;
      right: -280px;
      width: 250px;
      padding: 5px 10px;
      border-radius: 7px;
      background: #000;
      color: #fff;
      font-size: .8rem;
      font-weight: bold;
      opacity: 0;
      transition: .2s opacity ease-out;
    }

    .tooltip:hover:after,
    .tooltip.clicked:after {
      content: "";
      position: absolute;
      bottom: 45px;
      right: -10px;
      border: 5px solid #000;
      border-color: transparent black transparent transparent;
      opacity: 0;
      transition: .2s opacity ease-out;
    }

    .tooltip:hover:before,
    .tooltip:hover:after,
    .tooltip.clicked:before,
    .tooltip.clicked:after {
      opacity: 1;
    }

    .search-bar {
      display: flex;
    }

    .search-bar > span {
      position: relative;
      padding-top: 2rem;
      padding-left: 1rem;
    }

    .search-bar .search-help-icon {
      width: 19px;
      min-width: 19px;
      height: 19px;
      min-height: 19px;
      fill: white;
    }

    @media (max-width: 768px) {
      .content.flex {
        flex-direction: column-reverse;
      }

      img.research-trio,
      .sub-heading.quote {
        width: 100%;
      }
    }

    @media (max-width: 992px) {
      .search-bar {
        flex-direction: column;
      }

      .search-bar > span {
        padding: 1rem 0 0 0;
        width: 19px;
      }

      .tooltip:hover:before,
      .tooltip.clicked:before {
        bottom: initial;
      }

      .tooltip:hover:after,
      .tooltip.clicked:after {
        bottom: 3px;
      }
    }
  </style>

  <div class="hero-main site-frame">
    <div class="content">
      <h1>Discover Academic Excellence</h1>
      <div class="sub-heading h4 color-light">
        Aggie Experts facilitates expert collaboration and research discovery across all disciplines at UC Davis.
      </div>
      <div class="search-bar">
        <app-search-box
          id="searchBox"
          @search="${this._onSearch}"
          placeholder="search">
        </app-search-box>
        <span>
          <span class="tooltip search-help"
            data-text="Tip: Keywords are automatically combined with &quot;AND.&quot; Singular and plural forms may yield different results. Improvements coming soon!"
            @click="${(e) => e.currentTarget.classList.toggle('clicked')}">
            <ucdlib-icon class="search-help-icon" icon="ucdlib-experts:fa-question-circle"></ucdlib-icon>
          </span>
        </span>
      </div>
    </div>
  </div>
  <div class="site-frame">
    <div class="content flex">
      <img class="research-trio" src="/images/ae-research-image-trio-web.jpg" alt="featured image of researchers in various roles">
      <div class="sub-heading quote h4">
        <span class="quote-text">“There is immense power when a group of people with similar interests gets together to work toward the same goals.”</span>
        <span class="quote-author">Idowu Koyenikan</span>
      </div>
    </div>
  </div>
`;}
