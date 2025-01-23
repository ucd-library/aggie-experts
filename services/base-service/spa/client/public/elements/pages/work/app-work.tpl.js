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

    .work-type {
      text-transform: uppercase;
      color: var(--color-black-60);
      padding-left: .5rem;
      font-size: 1rem;
      font-weight: bold;
    }

    .about-work-type {
      text-transform: capitalize;
    }

    .hero-main {
      background: url('/images/watercolor-sage-solid.jpg') no-repeat center center;
      background-size: 100% auto;
      background-color: #F2FAF6;
      width: 100%;
      min-height: 12.25rem;
    }

    .color-light {
      color: white;
    }

    .content {
      width: 100%;
      margin: 0 auto;
      min-height: 700px;
    }

    .main-content {
      width: 53.5rem;
      margin: 0 auto;
      padding-top: 2.38rem;
    }

    .hero-text {
      padding: 2.625rem 2.625rem 4.1875rem 2.625rem;
    }

    .hero-text .works {
      display: flex;
      align-items: center;
    }

    .hero-text .works ucdlib-icon {
      width: 1rem;
      height: 1rem;
      fill: var(--color-sage);
    }

    .works ucdlib-icon.authors {
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

    .hero-main h1 ucdlib-icon,
    .hero-main .works span.hide-work ucdlib-icon,
    .hero-main .works span.show-work ucdlib-icon,
    .hero-main .works span.delete-work ucdlib-icon,
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
      fill: var(--color-sage);
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

    .main-content .abstract,
    .main-content .published,
    .main-content .subjects {
      margin-top: 2.38rem;
    }

    .main-content .works {
      display: flex;
      align-items: center;
    }

    .main-content .works .open-book {
      fill: var(--color-sage);
      width: 2.2rem;
      height: 2.2rem;
    }

    .main-content p {
      margin-bottom: 2.38rem;
    }

    .about.seperator,
    .authors.seperator {
      display: block;
      height: 4px;
      border: 0;
      padding: 0;
      margin: 0.625rem 0;
    }

    .about.seperator {
      border-top: 4px dotted var(--color-sage);
    }

    .authors.seperator {
      border-top: 4px dotted var(--color-aggie-gold);
    }

    h3.heading--highlight {
      font-weight: 700;
    }

    .authors-section {
      padding-bottom: 3rem;
      padding-top: 2.38rem;
    }

    .authors-section .authors-group {
      margin-bottom: 2.38rem;
    }

    app-contributor-row {
      margin-top: 1.19rem;
    }

    .hero-text .heading--highlight {
      margin-bottom: 1.5rem;
    }

    .full-text .link-row {
      display: flex;
      align-items: start;
      line-height: 2rem;
    }

    .full-text .link-row span {
      padding: .25rem 0 .25rem 0.625rem;
      line-height: 1.5rem;
    }

    .full-text ucdlib-icon {
      fill: var(--color-aggie-blue-60);
      margin-top: .2rem;
    }

    @media (max-width: 992px) {
      .main-content {
          width: 90%;
      }
    }

    .published .dot-separator {
      color: var(--color-sage);
      font-weight: bold;
      font-size: 1.2rem;
      padding: 0 .25rem;
    }
  `;

  return [elementStyles];
}

export function render() {
return html`
  <div class="content">
    <div class="hero-main site-frame">
      <div class="hero-text">
        <div class="works">
          <ucdlib-icon icon="ucdlib-experts:fa-book-open"></ucdlib-icon>
          <span class="work-type">${this.workType}</span>
        </div>
        <h1>${this.workName}</h1>
        <h3 class="heading--highlight">
          ${this.authors?.map((author, index) => html`
            ${author}${index < this.authors.length - 1 ? ', ' : ''}
          `)}
        </h3>
      </div>
    </div>

    <div class="main-content">
      <div class="works">
        <ucdlib-icon class="open-book" icon="ucdlib-experts:fa-book-open"></ucdlib-icon>
        <h2>About the <span class="about-work-type">${this.workType}</span></h2>
      </div>
      <hr class="about seperator">

      <div ?hidden="${!this.showFullText}" class="full-text">
        <h3 class="heading--highlight">Full Text</h3>

        <div class="link-row" ?hidden="${!this.ucLink}">
          <ucdlib-icon icon="ucdlib-experts:get-at-uc"></ucdlib-icon>
          <span><a href="${this.ucLink}">Get it at UC</a></span>
        </div>
        <div class="link-row" ?hidden="${!this.publisherLink}">
          <ucdlib-icon icon="ucdlib-experts:fa-network-wired"></ucdlib-icon>
          <span><a href="${this.publisherLink}">Publisher Page</a></span>
        </div>

      </div>

      <div ?hidden="${!this.abstract}" class="abstract">
        <h3 class="heading--highlight">Abstract</h3>
        <p>${this.abstract}</p>
      </div>

      <div ?hidden="${!this.showPublished}" class="published">
        <h3 class="heading--highlight">Published</h3>
         ${this.publisher} <span class="dot-separator">•</span> ${this.publishedVolume} <span class="dot-separator">•</span> ${this.publishedDate}
      </div>

      <!-- TODO SUBJECTS -->
      <!-- <div ?hidden="${!this.showSubjects}" class="subjects">
        <h3 class="heading--highlight">Subjects</h3>
      </div> -->

      <div class="authors-section" ?hidden="${!this.showAuthors}">
        <div class="works">
          <ucdlib-icon class="authors" icon="ucdlib-experts:fa-people-group"></ucdlib-icon>
          <h2>UC Davis Authors</h2>
        </div>
        <hr class="authors seperator">
        <div class="authors-group">
          ${this.ucAuthors?.map(
            (author) => html`
              <app-contributor-row result="${author.position}" .result=${author}></app-contributor-row>
            `
          )}
        </div>

      </div>
    </div>
  </div>
`;}
