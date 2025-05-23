import { html, css, unsafeCSS } from 'lit';

import { sharedStyles } from '../../styles/shared-styles';

import buttonsCss from "@ucd-lib/theme-sass/2_base_class/_buttons.css";
import headingsCss from "@ucd-lib/theme-sass/2_base_class/_headings.css";

export function styles() {
  const elementStyles = css`
    ${unsafeCSS(sharedStyles)}
    ${unsafeCSS(buttonsCss)}
    ${unsafeCSS(headingsCss)}
    :host {
      display: block;
    }

    [hidden] {
      display: none !important;
    }

    .hero-main {
      background: url('/images/watercolor-thiebaud-icing-solid.jpg') no-repeat center center;
      background-size: cover;
      background-color: #FBE3F3;
      width: 100%;
    }

    .color-light {
      color: white;
    }

    .content {
      width: 100%;
      margin: 0 auto;
    }

    .main-content {
      width: 53.5rem;
      margin: 0 auto;
      padding-top: 2.38rem;
    }

    .hero-text {
      padding: 2.625rem;
    }

    .grants span {
      color: var(--color-black-60);
      padding-left: .5rem;
      font-size: 1rem;
      font-weight: bold;
    }

    .hero-text .grants {
      display: flex;
      align-items: center;
    }

    .hero-text .grants ucdlib-icon {
      width: 1rem;
      height: 1rem;
      fill: var(--color-thiebaud-icing);
    }

    .grants ucdlib-icon.contributors {
      width: 2.2em;
      height: 2.2rem;
      fill: var(--color-aggie-gold);
    }

    h1, h3 {
      margin-top: .5rem;
      margin-bottom: 0;
      padding-bottom: 0;
      color: var(--color-aggie-blue);
    }

    /* .hero-main h1 .tooltip:hover ucdlib-icon,
    .hero-main .grants span.hide-grant:hover ucdlib-icon,
    .hero-main .grants span.show-grant:hover ucdlib-icon,
    .hero-main .grants span.delete-grant:hover ucdlib-icon,
    .introduction h3 ucdlib-icon:hover,
    .roles-websites .roles h3 ucdlib-icon:hover,
    .roles-websites .websites h3 ucdlib-icon:hover,
    .works-abbreviated .works-heading .works-edit-download ucdlib-icon:hover,
    .grants-abbreviated .grants-heading .grants-edit-download ucdlib-icon:hover {
      fill: var(--color-aggie-thiebaud-icing);
    } */


    .hero-main h1 ucdlib-icon,
    .hero-main .grants span.hide-grant ucdlib-icon,
    .hero-main .grants span.show-grant ucdlib-icon,
    .hero-main .grants span.delete-grant ucdlib-icon,
    .introduction h3 ucdlib-icon,
    .roles-websites h3 ucdlib-icon {
      display: inline-block;
      width: 1.2rem;
      height: 1.2rem;
      min-width: 1.2rem;
      min-height: 1.2rem;
      fill: var(--color-aggie-blue-80);
      cursor: pointer;
      padding-left: .25rem;
    }

    .authors a {
      color: var(--color-aggie-blue);
    }

    .authors {
      margin-bottom: 0;
      margin-top: 0.5rem;
    }

    svg {
      fill: var(--color-thiebaud-icing);
    }

    .main-content .article {
      display: flex;
      align-items: center;
      margin-bottom: 0;
    }

    .main-content .article svg {
      font-size: 2rem;
    }

    .main-content svg {
      fill: var(--color-aggie-blue-60);
    }

    .main-content h2 {
      padding: 0 0 0 1rem;
      margin-bottom: 0;
      margin-top: 0;
      color: var(--color-black-60);
    }

    .main-content .abstract {
      margin-top: 2.38rem;
    }

    .main-content .grants {
      display: flex;
      align-items: center;
    }

    .main-content .grants .file-invoice {
      fill: var(--color-thiebaud-icing);
      width: 2.2rem;
      height: 2.2rem;
    }

    .main-content p {
      margin-bottom: 2.38rem;
    }

    .about.seperator,
    .contributors.seperator {
      display: block;
      height: 4px;
      border: 0;
      padding: 0;
      margin: 0.625rem 0;
    }

    .about.seperator {
      border-top: 4px dotted var(--color-thiebaud-icing);
    }

    .contributors.seperator {
      border-top: 4px dotted var(--color-aggie-gold);
    }

    h3.heading--highlight {
      font-weight: 700;
    }

    .contributors-section {
      padding-bottom: 3rem;
    }

    .contributors-section .contributor-group {
      margin-bottom: 2.38rem;
    }

    app-contributor-row {
      margin-top: 1.19rem;
    }

    .hero-text .status {
      text-transform: uppercase;
      color: var(--color-aggie-blue);
      font-weight: bold;

      background-color: var(--color-black-20);
      padding: 5px 8px;
    }

    .hero-text .status.active {
      background-color: var(--color-farmers-market);
    }

    .hero-text .heading--highlight {
      margin-bottom: 1.5rem;
    }

    @media (max-width: 992px) {
      .hero-text {
        padding-left: 0;
        padding-right: 0;
        width: 90%;
        margin: auto;
      }
      .main-content {
          width: 90%;
      }
    }
  `;

  return [elementStyles];
}

export function render() {
return html`
  <div class="content">
    <div class="hero-main site-frame">
      <div class="hero-text">
        <div class="grants">
          <ucdlib-icon icon="ucdlib-experts:fa-file-invoice-dollar"></ucdlib-icon>
          <span>GRANT</span>
        </div>
        <h1>${this.grantName}</h1>
        <h3 class="heading--highlight">${this.startDate} – ${this.endDate}</h3>
        <span class="status${!this.completed ? ' active' : ''}">${this.completed ? 'Complete' : 'Active'}</span>
      </div>
    </div>

    <div class="main-content">
      <div class="grants" ?hidden="${!this.showAboutSection}">
        <ucdlib-icon class="file-invoice" icon="ucdlib-experts:fa-file-invoice-dollar"></ucdlib-icon>
        <h2>About the Grant</h2>
      </div>
      <hr class="about seperator" ?hidden="${!this.showAboutSection}">

      <div ?hidden="${!this.awardedBy}" class="awarded-by">
        <h3 class="heading--highlight">Awarded by</h3>
        <p>${this.awardedBy}</p>
      </div>

      <div ?hidden="${!this.grantNumber}" class="grant-number">
        <h3 class="heading--highlight">Grant Number</h3>
        <p>${this.grantNumber}</p>
      </div>

      <div ?hidden="${!this.grantAdmin || true}" class="grant-admin">
        <h3 class="heading--highlight">Grant Admin</h3>
        <p>${this.grantAdmin}</p>
      </div>

      <div ?hidden="${!this.purpose}" class="purpose">
        <h3 class="heading--highlight">Purpose</h3>
        <p>${this.purpose}</p>
      </div>

      <div class="contributors-section" ?hidden="${!this.showContributorsSection}">
        <div class="grants">
          <ucdlib-icon class="contributors" icon="ucdlib-experts:fa-people-group"></ucdlib-icon>
          <h2>Known Contributors</h2>
        </div>
        <hr class="contributors seperator">
        <div class="contributor-group">
          <h3 class="heading--highlight" ?hidden="${this.pis.length === 0}">Principal Investigator</h3>
          ${this.pis.map(
            (result) => html`
              <app-contributor-row result="${result.position}" .result=${result}></app-contributor-row>
            `
          )}
        </div>
        <div class="contributor-group">
          <h3 class="heading--highlight" ?hidden="${this.coPis.length === 0}">Co-Investigator</h3>
          ${this.coPis.map(
            (result) => html`
              <app-contributor-row result="${result.position}" .result=${result}></app-contributor-row>
            `
          )}
        </div>
        <div class="contributor-group">
          <h3 class="heading--highlight" ?hidden="${this.leaders.length === 0}">Leader</h3>
          ${this.leaders.map(
            (result) => html`
              <app-contributor-row result="${result.position}" .result=${result}></app-contributor-row>
            `
          )}
        </div>
        <div class="contributor-group">
          <h3 class="heading--highlight" ?hidden="${this.researchers.length === 0}">Researcher</h3>
          ${this.researchers.map(
            (result) => html`
              <app-contributor-row result="${result.position}" .result=${result}></app-contributor-row>
            `
          )}
        </div>

      </div>
    </div>
  </div>
`;}
