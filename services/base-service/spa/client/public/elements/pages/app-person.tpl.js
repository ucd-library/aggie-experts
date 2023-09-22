import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { sharedStyles } from '../styles/shared-styles';

import buttonsCss from "@ucd-lib/theme-sass/2_base_class/_buttons.css";

export function render() {
return html`
  <style>
    ${sharedStyles}
    ${buttonsCss}

    :host {
      display: block;
    }

    .hero-main {
      background: url('../images/watercolor-gold-solid.jpg') no-repeat center center;
      background-size: 100% auto;
      background-color: #F2FAF6;
      width: 100%;
      height: 12.25rem;
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
      width: 60%;
      margin: 0 auto;
      padding-top: 2.38rem;
    }

    .hero-text {
      padding: 2.625rem 2.625rem 4.1875rem 2.625rem;
    }

    .experts span {
      color: var(--color-black-60);
      padding-left: .5rem;
      font-size: 1rem;
      font-weight: bold;
    }

    .hero-text .experts {
      display: flex;
      align-items: center;
    }

    .hero-text .experts ucdlib-icon {
      width: 1rem;
      height: 1rem;
      fill: var(--color-aggie-gold);
    }

    h1 {
      margin-top: .5rem;
      margin-bottom: 0;
      padding-bottom: 0;
      color: var(--color-aggie-blue);
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

    .main-content .abstract {
      margin-top: 2.38rem;
    }

    .main-content .experts {
      display: flex;
      align-items: center;
    }

    .main-content .experts .address-card {
      fill: var(--color-aggie-gold);
      width: 2.2rem;
      height: 2.2rem;
    }

    .seperator {
      /* border-top: 4px dotted var(--color-sage); */
      display: block;
      height: 4px;
      border: 0;
      border-top: 4px dotted var(--color-aggie-gold);
      /* margin: 1em 0; */
      padding: 0;
      margin: 0.625rem 0;
    }

    .roles-websites h4 {
      margin: 0.7rem 0;
    }

    .roles-websites .link-row {
      display: flex;
      align-items: center;
      line-height: 2rem;
    }

    .roles-websites .link-row span {
      padding-left: 0.625rem;
    }

    .introduction h4 {
      margin-bottom: 0;
      margin-top: 0;
    }

    .introduction .more-about-me,
    .works-abbreviated .see-all-works {
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    .introduction .more-about-me span,
    .works-abbreviated .see-all-works span {
      padding-left: .5rem;
      font-weight: bold;
      color: var(--color-aggie-blue-80);
    }

    .introduction .more-about-me ucdlib-icon {
      fill: var(--color-aggie-gold);
    }

    .roles-websites {
      display: flex;
      padding-top: 2.375rem;
    }

    .roles-websites .roles {
      width: 50%;
    }

    .roles-websites ucdlib-icon {
      fill: var(--color-aggie-blue-60);
    }

    .roles-websites .title-dept {
      margin: 0 0 .4rem 0;
    }

    .roles-websites .role {
      padding-bottom: 1rem;
    }

    .works-abbreviated {
      padding-top: 2.56rem;
    }

    .works-abbreviated .see-all-works ucdlib-icon {
      fill: var(--color-sage);
    }

    .works-abbreviated .works-heading {
      display: flex;
      align-items: center;
    }

    .works-abbreviated .works-heading ucdlib-icon {
      fill: var(--color-sage);
      width: 2.2rem;
      height: 2.2rem;
    }

    .works-abbreviated .seperator {
      border-top: 4px dotted var(--color-sage);
    }

    .works-abbreviated .work h5 {
      color: var(--color-aggie-blue-80);
      margin: .5rem 0;
    }

    .work-details {
      display: flex;
      align-items: center;
    }

  </style>

  <div class="content">
    <div class="hero-main site-frame">
      <div class="hero-text">
        <div class="experts">
        <ucdlib-icon icon="ucdlib-experts:fa-user"></ucdlib-icon>
        <span>EXPERT</span>
        </div>
        <h1>${this.personName}</h1>
      </div>
    </div>

    <div class="main-content">
      <div class="experts">
        <ucdlib-icon class="address-card" icon="ucdlib-experts:fa-address-card"></ucdlib-icon>
        <h2>About Me</h2>
      </div>
      <hr class="seperator">

      <div class="introduction">
        <h4>Introduction</h4>
        <ucdlib-md>
          <ucdlib-md-content>
            ${this.showMoreAboutMeLink ? this.introduction.substr(0, 500) + '...' : this.introduction}
          </ucdlib-md-content>
        </ucdlib-md>

        <div class="more-about-me" ?hidden="${!this.showMoreAboutMeLink}" @click="${(e) => this.showMoreAboutMeLink = false}">
          <ucdlib-icon icon="ucdlib-experts:fa-circle-chevron-right"></ucdlib-icon>
          <span>MORE ABOUT ME</span>
        </div>
      </div>

      <div class="roles-websites">
        <div class="roles">
          <h4>Roles</h4>
          <div class="role">
            <div>
              <p class="title-dept">Title, Department</p>
            </div>
            <div class="link-row">
              <ucdlib-icon icon="ucdlib-experts:fa-network-wired"></ucdlib-icon>
              <span><a href="">website.ucdavis.edu/~name</a></span>
            </div>
            <div class="link-row">
              <ucdlib-icon icon="ucdlib-experts:fa-envelope"></ucdlib-icon>
              <span><a href="">email@ucdavis.edu</a></span>
            </div>
          </div>
          <div class="role">
            <div>
              <p class="title-dept">Title, Department</p>
            </div>
            <div class="link-row">
              <ucdlib-icon icon="ucdlib-experts:fa-network-wired"></ucdlib-icon>
              <span><a href="">website.ucdavis.edu/~name</a></span>
            </div>
            <div class="link-row">
              <ucdlib-icon icon="ucdlib-experts:fa-envelope"></ucdlib-icon>
              <span><a href="">email@ucdavis.edu</a></span>
            </div>
          </div>
        </div>

        <div class="websites">
          <h4>Websites</h4>
          <div class="link-row" ?hidden="${!this.orcId}">
            <ucdlib-icon icon="ucdlib-experts:fa-orcid"></ucdlib-icon>
            <span><a href="https://orcid.org/${this.orcId}">${this.orcId}</a></span>
          </div>
          <div class="link-row" ?hidden="${!this.scopusId}">
            <ucdlib-icon icon="ucdlib-experts:scopus"></ucdlib-icon>
            <span><a href="https://www.scopus.com/authid/detail.uri?authorId=${this.scopusId}">Scopus</a></span>
          </div>
        </div>
      </div>

      <div style="display: flex; flex-direction: row-reverse;">
        <a href=""
          style="padding-top: 0.2rem; padding-bottom: 0.2rem; margin-top: 3rem;"
          @click="${this._downloadRIS}"
          class="btn">Download RIS (TODO REMOVE)</a>
      </div>
      <div class="works-abbreviated" ?hidden="${this.citations.length === 0}">
        <div class="works-heading">
          <ucdlib-icon class="address-card" icon="ucdlib-experts:fa-book-open"></ucdlib-icon>
          <h2>${this.citations.length} Works</h2>
        </div>
        <hr class="seperator">
        ${this.citationsDisplayed.map(
          (cite) => html`
            <h4 style="margin: 1.19rem 0;">${cite.issued?.['date-parts']?.[0]}</h4>
            <div class="work">
              <h5>${cite.title}</h5>
              <div class="work-details">
                <span style="min-width: fit-content;">${cite.type}</span>
                <span style="padding: 0 .75rem; color: var(--black, #000); font-family: Proxima Nova; font-size: 1.1875rem; font-style: normal; font-weight: 700; line-height: 1.92125rem; text-transform: uppercase;">.</span>
                ${unsafeHTML(cite.apa.replace(cite.title+'. ', ''))}
              </div>
            </div>
            <br>
          `
        )}
        <div class="see-all-works" @click="${this._seeAllWorks}">
          <ucdlib-icon icon="ucdlib-experts:fa-circle-chevron-right"></ucdlib-icon>
          <span>SEE ALL ${this.citations.length} WORKS</span>
        </div>
      </div>
    </div>
  </div>
`;}
