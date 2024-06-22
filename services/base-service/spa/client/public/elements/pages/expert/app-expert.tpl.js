import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { sharedStyles } from '../../styles/shared-styles';

import buttonsCss from "@ucd-lib/theme-sass/2_base_class/_buttons.css";
import headingsCss from "@ucd-lib/theme-sass/2_base_class/_headings.css";

import utils from '../../../lib/utils';

export function render() {
return html`
  <style>
    ${sharedStyles}
    ${buttonsCss}
    ${headingsCss}

    :host {
      display: block;
    }

    [hidden] {
      display: none !important;
    }

    .hero-main {
      background: url('/images/watercolor-gold-solid.jpg') no-repeat center center;
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
      width: 53.5rem;
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

    .hero-main h1 .tooltip:hover ucdlib-icon,
    .hero-main .experts span.hide-expert:hover ucdlib-icon,
    .hero-main .experts span.show-expert:hover ucdlib-icon,
    .hero-main .experts span.delete-expert:hover ucdlib-icon,
    .introduction h3 ucdlib-icon:hover,
    .roles-websites .roles h3 ucdlib-icon:hover,
    .roles-websites .websites h3 ucdlib-icon:hover,
    .works-abbreviated .works-heading .works-edit-download ucdlib-icon:hover,
    .grants-abbreviated .grants-heading .grants-edit-download ucdlib-icon:hover {
      fill: var(--color-aggie-gold);
    }


    .hero-main h1 ucdlib-icon,
    .hero-main .experts span.hide-expert ucdlib-icon,
    .hero-main .experts span.show-expert ucdlib-icon,
    .hero-main .experts span.delete-expert ucdlib-icon,
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
      display: block;
      height: 4px;
      border: 0;
      border-top: 4px dotted var(--color-aggie-gold);
      padding: 0;
      margin: 0.625rem 0;
    }

    .about-me.seperator {
      padding-bottom: 0.7rem;
    }

    .roles-websites .link-row {
      display: flex;
      align-items: center;
      line-height: 2rem;
    }

    .roles-websites .link-row span {
      padding: .25rem 0 .25rem 0.625rem;
      line-height: 1.5rem;
    }

    .introduction {
      padding-bottom: 1rem;
    }

    .introduction h3 {
      margin-bottom: 0;
      margin-top: 0;
    }

    .research-interests h5 {
      margin-top: 1rem;
      margin-bottom: 1rem;
    }

    .introduction .more-about-me,
    .grants-abbreviated .see-all-grants,
    .works-abbreviated .see-all-works {
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    .introduction .more-about-me,
    .no-introduction .no-display-data {
      padding-bottom: 1rem;
    }

    .see-all-grants,
    .see-all-works {
      padding-bottom: 2rem;
    }

    .introduction .more-about-me span,
    .grants-abbreviated .see-all-grants span,
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
      /* padding-top: 2.375rem; */
      /* padding-top: 1rem; */
    }

    .roles-websites .roles,
    .roles-websites .websites {
      width: 50%;
      overflow-wrap: anywhere;
    }

    .roles-websites .roles {
      padding-right: 1rem;
    }

    .roles-websites .roles h3,
    .roles-websites .websites h3  {
      padding-top: 0;
      margin-top: 0;
      margin-bottom: .5rem;
    }

    .roles-websites ucdlib-icon {
      fill: var(--color-aggie-blue-60);
    }

    .roles-websites .title-dept {
      margin: 0 0 .4rem 0;
    }

    .roles-websites .role {
      padding-bottom: 1rem;
      overflow: hidden;
    }

    .works-abbreviated {
      padding-top: 2.56rem;
      padding-bottom: 2rem;
    }

    .grants-abbreviated {
      padding-top: 2.56rem;
    }

    .works-abbreviated .see-all-works ucdlib-icon {
      fill: var(--color-sage);
    }

    .grants-abbreviated .see-all-grants ucdlib-icon {
      fill: var(--color-thiebaud-icing);
    }

    .grants-abbreviated .grants-heading,
    .works-abbreviated .works-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .grants-abbreviated .grants-heading ucdlib-icon {
      fill: var(--color-thiebaud-icing);
      height: 2.2rem;
    }

    .works-abbreviated .works-heading ucdlib-icon {
      fill: var(--color-sage);
      width: 2.2rem;
      height: 2.2rem;
    }

    .grants-abbreviated .seperator {
      border-top: 4px dotted var(--color-thiebaud-icing);
      padding-bottom: .33rem;
    }

    .works-abbreviated .seperator {
      border-top: 4px dotted var(--color-sage);
      padding-bottom: .33rem;
    }

    .grants-abbreviated .grant h5,
    .works-abbreviated .work h5 {
      color: black;
      margin: .5rem 0;
    }

    .grant-details .dot,
    .work-details .dot {
      padding: 0 0.25rem;
      color: var(--black, #000);
      font-family: Proxima Nova;
      font-size: 1.1875rem;
      font-style: normal;
      font-weight: 700;
      line-height: 1.92125rem;
      text-transform: uppercase;
      position: relative;
      bottom: 0.25rem;
    }

    .grants-abbreviated .grants-heading .grants-edit-download ucdlib-icon,
    .works-abbreviated .works-heading .works-edit-download ucdlib-icon {
      fill: var(--color-aggie-blue-80);
      width: 1.2rem;
      height: 1.2rem;
      min-width: 1.2rem;
      min-height: 1.2rem;
      cursor: pointer;
    }

    .tooltip {
      cursor: pointer;
    }

    .tooltip:hover:before {
      content: attr(data-text);
      position: absolute;
      bottom: 35px;
      right: -35px;

      width: 140px;
      padding: 2px 10px;
      border-radius: 7px;
      background: #000;
      color: #fff;
      text-align: center;
      font-size: .8rem;
      font-weight: bold;

      opacity: 0;
      transition: .2s opacity ease-out;
    }

    .tooltip:hover:after {
      content: "";
      position: absolute;
      bottom: 25px;
      right: 40px;

      border: 5px solid #000;
      border-color: black transparent transparent transparent;

      opacity: 0;
      transition: .2s opacity ease-out;
    }

    .tooltip:hover:before, .tooltip:hover:after {
      opacity: 1;
    }

    .tooltip.edit-name:hover:before {
      width: 80px;
      bottom: 53px;
      right: -40px;
    }

    .tooltip.edit-name:hover:after {
      bottom: 43px;
      right: 5px;
    }

    .tooltip.hide-expert:before {
      width: 90px;
      bottom: 33px;
      right: -45px;
    }

    .tooltip.hide-expert:after {
      bottom: 23px;
      right: 5px;
    }

    .tooltip.show-expert:before {
      width: 96px;
      bottom: 33px;
      right: -48px;
    }

    .tooltip.show-expert:after {
      bottom: 23px;
      right: 5px;
    }

    .tooltip.delete-expert:before {
      width: 120px;
      bottom: 33px;
      right: -60px;
    }

    .tooltip.delete-expert:after {
      bottom: 23px;
      right: 5px;
    }

    .tooltip.edit-roles:before {
      width: 80px;
      bottom: 35px;
      right: -40px;
    }

    .tooltip.edit-roles:after {
      bottom: 25px;
      right: 5px;
    }

    .tooltip.edit-websites:before {
      width: 100px;
      bottom: 35px;
      right: -50px;
    }

    .tooltip.edit-websites:after {
      bottom: 25px;
      right: 5px;
    }

    .tooltip.edit-about-me:before {
      width: 130px;
      bottom: 35px;
      right: -65px;
    }

    .tooltip.edit-about-me:after {
      bottom: 25px;
      right: 5px;
    }

    .tooltip.edit-grants:before,
    .tooltip.edit-works:before {
      width: 80px;
      bottom: 30px;
      right: -20px;
    }

    .tooltip.edit-grants:after,
    .tooltip.edit-works:after {
      bottom: 20px;
      right: 22px;
    }

    .tooltip.download-all-grants:before {
      width: 150px;
      bottom: 30px;
      right: -75px;
    }

    .tooltip.download-all-works:before {
      width: 145px;
      bottom: 30px;
      right: -70px;
    }

    .tooltip.download-all-grants:after,
    .tooltip.download-all-works:after {
      bottom: 20px;
      right: 5px;
    }

    .work-details span {
      line-height: var(--lh-html);
    }

    .csl-bib-body, .csl-entry {
      display: inline;
      line-height: var(--lh-html);
    }

    .edit-expert-btn {
      margin-left: 1.19rem;
      border-radius: 1.25em;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: auto;
      min-width: 10ch;
      min-height: 2.5em;
      margin-bottom: 0;
      padding: 0.625em 1em;
      border: 1px solid #b0d0ed;
      background-color: white;
      color: #022851;
      cursor: pointer;
      font-family: inherit;
      font-weight: 700;
      line-height: 1.1;
      text-align: center;
      text-decoration: none;
      --btn-arrow-color: #ffbf00;
      /* padding-right: 1.5em;
      padding-left: 0.75em; */
      transition: 0.2s padding ease-out;
      border-color: #ffbf00;
      background-color: transparent;
    }

    .edit-expert-btn:hover {
      background-color: #ffbf00;
      color: #022851;
      border-color: #ffbf00;
    }

    .refresh-profile {
      padding-bottom: 2.38rem;
      display: flex;
      align-items: center;
    }

    .last-updated-label,
    .no-display-data {
      color: #666;
      font-size: .95rem;
      font-style: italic;
      line-height: 1.625rem;
      padding-left: 1rem;
    }

    .no-display-data {
      padding-top: .5rem;
      padding-left: 0;
    }

    .btn--invert:before {
      content: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMTYiIHdpZHRoPSIxNiIgdmlld0JveD0iMCAwIDUxMiA1MTIiPjwhLS0hRm9udCBBd2Vzb21lIEZyZWUgNi41LjAgYnkgQGZvbnRhd2Vzb21lIC0gaHR0cHM6Ly9mb250YXdlc29tZS5jb20gTGljZW5zZSAtIGh0dHBzOi8vZm9udGF3ZXNvbWUuY29tL2xpY2Vuc2UvZnJlZSBDb3B5cmlnaHQgMjAyMyBGb250aWNvbnMsIEluYy4tLT48cGF0aCBmaWxsPSIjQjBEMEVEIiBkPSJNMTA1LjEgMjAyLjZjNy43LTIxLjggMjAuMi00Mi4zIDM3LjgtNTkuOGM2Mi41LTYyLjUgMTYzLjgtNjIuNSAyMjYuMyAwTDM4Ni4zIDE2MEgzNTJjLTE3LjcgMC0zMiAxNC4zLTMyIDMyczE0LjMgMzIgMzIgMzJINDYzLjVjMCAwIDAgMCAwIDBoLjRjMTcuNyAwIDMyLTE0LjMgMzItMzJWODBjMC0xNy43LTE0LjMtMzItMzItMzJzLTMyIDE0LjMtMzIgMzJ2MzUuMkw0MTQuNCA5Ny42Yy04Ny41LTg3LjUtMjI5LjMtODcuNS0zMTYuOCAwQzczLjIgMTIyIDU1LjYgMTUwLjcgNDQuOCAxODEuNGMtNS45IDE2LjcgMi45IDM0LjkgMTkuNSA0MC44czM0LjktMi45IDQwLjgtMTkuNXpNMzkgMjg5LjNjLTUgMS41LTkuOCA0LjItMTMuNyA4LjJjLTQgNC02LjcgOC44LTguMSAxNGMtLjMgMS4yLS42IDIuNS0uOCAzLjhjLS4zIDEuNy0uNCAzLjQtLjQgNS4xVjQzMmMwIDE3LjcgMTQuMyAzMiAzMiAzMnMzMi0xNC4zIDMyLTMyVjM5Ni45bDE3LjYgMTcuNSAwIDBjODcuNSA4Ny40IDIyOS4zIDg3LjQgMzE2LjcgMGMyNC40LTI0LjQgNDIuMS01My4xIDUyLjktODMuN2M1LjktMTYuNy0yLjktMzQuOS0xOS41LTQwLjhzLTM0LjkgMi45LTQwLjggMTkuNWMtNy43IDIxLjgtMjAuMiA0Mi4zLTM3LjggNTkuOGMtNjIuNSA2Mi41LTE2My44IDYyLjUtMjI2LjMgMGwtLjEtLjFMMTI1LjYgMzUySDE2MGMxNy43IDAgMzItMTQuMyAzMi0zMnMtMTQuMy0zMi0zMi0zMkg0OC40Yy0xLjYgMC0zLjIgLjEtNC44IC4zcy0zLjEgLjUtNC42IDF6Ii8+PC9zdmc+");
      width: 2em;
      position: relative;
      left: 0.2rem;
    }

    .btn--invert {
      /* width: 165px; */
      border-color: var(--color-aggie-blue-50);
      padding: .5rem 1.5rem .5rem .5rem;
      font-size: 1rem;
    }

    .hidden-grants-label,
    .hidden-works-label {
      color: var(--other-h3-gray, #666);
      font-size: 1.03875rem;
      font-style: italic;
      font-weight: 400;
      line-height: 2rem;
    }

    @media (max-width: 1080px) {
      .tooltip.download-all-grants:before {
        right: -25px;
      }

      .tooltip.download-all-works:before {
        right: -25px;
      }
    }

    @media (max-width: 992px) {
      .main-content {
        width: 90%;
      }
    }

    @media (max-width: 768px) {
      .roles-websites {
        display: block;
      }

      .roles-websites .roles,
      .roles-websites .websites {
        width: 100%;
      }
    }

    h3.heading--highlight {
      font-weight: 700;
    }

  </style>

  <div class="content">
    <app-modal-overlay
      ?hidden="${!this.showModal}"
      .visible="${this.showModal}"
      .title="${this.modalTitle}"
      .content="${this.modalContent}"
      .hideCancel="${this.hideCancel}"
      .hideSave="${this.hideSave}"
      .hideOK="${this.hideOK}"
      .hideOaPolicyLink="${this.hideOaPolicyLink}"
      .errorMode="${this.errorMode}"
      @cancel=${(e) => this.showModal = false}
      @save=${this._onSave}>
    </app-modal-overlay>
    <div class="hero-main site-frame">
      <div class="hero-text">
        <div class="experts">
          <ucdlib-icon icon="ucdlib-experts:fa-user"></ucdlib-icon>
          <span>EXPERT ${!this.isVisible ? '(HIDDEN)' : ''}</span>
          <button ?hidden="${this.hideEdit || APP_CONFIG.user?.expertId === this.expertId}" @click="${this._editExpertClick}" class="edit-expert-btn">Edit User</button>
          <div ?hidden="${(!this.isAdmin || !this.hideEdit || this.expertEditing !== this.expertId) && APP_CONFIG.user?.expertId !== this.expertId}" style="position: relative; display: flex;">
            <span ?hidden="${!this.isVisible || !this.isAdmin}" class="tooltip hide-expert" data-text="Hide expert">
              <ucdlib-icon icon="ucdlib-experts:fa-eye" @click=${this._hideExpert}></ucdlib-icon>
            </span>
            <span ?hidden="${this.isVisible}" class="tooltip show-expert" data-text="Show expert">
              <ucdlib-icon icon="ucdlib-experts:fa-eye-slash" @click=${this._showExpert}></ucdlib-icon>
            </span>
          </div>
          <div ?hidden="${(!this.isAdmin || !this.hideEdit || this.expertEditing !== this.expertId) && APP_CONFIG.user?.expertId !== this.expertId}" style="position: relative; display: flex;">
            <span class="tooltip delete-expert" data-text="Delete expert">
              <ucdlib-icon icon="ucdlib-experts:fa-trash" @click=${this._deleteExpert}></ucdlib-icon>
            </span>
          </div>
        </div>
        <h1>${this.expertName}
          <a ?hidden="${!this.canEdit}" href="https://org.ucdavis.edu/odr/" style="position: relative;" target="_blank">
            <span class="tooltip edit-name" data-text="Edit name">
              <ucdlib-icon icon="ucdlib-experts:fa-pen-to-square"></ucdlib-icon>
            </span>
          </a>
        </h1>
      </div>
    </div>

    <div class="main-content">
      <!-- <div ?hidden="${!this.canEdit}" class="refresh-profile">
        <button class="btn btn--invert" @click="${this._refreshProfileClicked}">Refresh Profile Data</button>
        <div class="last-updated-label">Last Updated: Mon XX, 20XX, X:XXpm</div>
      </div> -->
      <!-- <div class="test-cdl-error" style="padding-bottom: 2rem;">
        <button class="btn" @click="${this._cdlErrorModal}">CDL Error</button>
      </div> -->
      <div class="experts">
        <ucdlib-icon class="address-card" icon="ucdlib-experts:fa-address-card"></ucdlib-icon>
        <h2>About Me</h2>
      </div>
      <hr class="about-me seperator">

      <div class="introduction no-introduction" ?hidden="${!this.canEdit || this.introduction || this.researchInterests}">
        <h3 class="heading--highlight">Introduction
          <span ?hidden="${!this.canEdit}" style="position: relative;">
            <span class="tooltip edit-about-me" data-text="Edit Introduction">
              <ucdlib-icon icon="ucdlib-experts:fa-pen-to-square"
                @click=${this._editAboutMe}>
              </ucdlib-icon>
            </span>
          </span>
        </h3>
        <div class="no-display-data">No data to display</div>
      </div>
      <div class="introduction" ?hidden="${!this.introduction && !this.researchInterests}">
        <h3 class="heading--highlight">Introduction
          <span ?hidden="${!this.canEdit}" style="position: relative;">
            <span class="tooltip edit-about-me" data-text="Edit Introduction">
              <ucdlib-icon icon="ucdlib-experts:fa-pen-to-square"
                @click=${this._editAboutMe}>
              </ucdlib-icon>
            </span>
          </span>
        </h3>
        <ucdlib-md ?hidden="${!this.introduction}">
          <ucdlib-md-content>
            ${this.truncateIntroduction ? this.introduction.substr(0, 500) + '...' : this.introduction}
          </ucdlib-md-content>
        </ucdlib-md>

        <div class="research-interests" ?hidden="${!this.researchInterests || (this.truncateResearchInterests && this.researchInterests.substr(0, 500 - this.introduction.length) <= 75)}">
          <h5>Research Interests</h5>
          <ucdlib-md>
            <ucdlib-md-content>
              ${this.truncateResearchInterests ? this.researchInterests.substr(0, 500 - this.introduction.length) + '...' : this.researchInterests}
            </ucdlib-md-content>
          </ucdlib-md>
        </div>

        <div class="more-about-me" ?hidden="${!this.showMoreAboutMeLink}" @click="${this._showMoreAboutMeClick}">
          <ucdlib-icon icon="ucdlib-experts:fa-circle-chevron-right"></ucdlib-icon>
          <span>MORE ABOUT ME</span>
        </div>
      </div>


      <div class="roles-websites">

        <div class="roles no-roles" ?hidden="${!this.canEdit || this.roles.length}">
          <h3 class="heading--highlight">Roles
            <a ?hidden="${!this.canEdit}" href="https://org.ucdavis.edu/odr/" style="position: relative;" target="_blank">
              <span class="tooltip edit-roles" data-text="Edit roles">
                <ucdlib-icon icon="ucdlib-experts:fa-pen-to-square"></ucdlib-icon>
              </span>
            </a>
          </h3>
          <div class="no-display-data">No data to display</div>
        </div>

        <div class="roles" ?hidden="${!this.roles.length}">
          <h3 class="heading--highlight">Roles
            <a ?hidden="${!this.canEdit}" href="https://org.ucdavis.edu/odr/" style="position: relative;" target="_blank">
              <span class="tooltip edit-roles" data-text="Edit roles">
                <ucdlib-icon icon="ucdlib-experts:fa-pen-to-square"></ucdlib-icon>
              </span>
            </a>
          </h3>

          ${this.roles.map(
          (role) => html`
            <div class="role">
            <div ?hidden="${!role.title}">
              <p class="title-dept">${role.title}${role.department ? ', ' + role.department : ''}</p>
            </div>
            <!-- <div class="link-row" ?hidden="${!role.websiteUrl}">
              <ucdlib-icon icon="ucdlib-experts:fa-network-wired"></ucdlib-icon>
              <span><a href="${role.websiteUrl}">${role.websiteUrl}</a></span>
            </div> -->
            <div class="link-row" ?hidden="${!role.email}">
              <ucdlib-icon icon="ucdlib-experts:fa-envelope"></ucdlib-icon>
              <span><a href="mailto:${role.email}">${role.email}</a></span>
            </div>
          </div>
          `
        )}
        </div>

        <div class="websites no-websites" ?hidden="${!this.canEdit || this.websites.length || this.orcId || this.scopusId || this.researcherId}">
          <h3 class="heading--highlight">Links
            <span ?hidden="${!this.canEdit}" style="position: relative;">
              <span class="tooltip edit-websites" data-text="Edit links">
                <ucdlib-icon icon="ucdlib-experts:fa-pen-to-square"
                  @click=${this._editWebsites}>
                </ucdlib-icon>
              </span>
            </span>
          </h3>
          <div class="no-display-data">No data to display</div>
        </div>

        <div class="websites" ?hidden="${!this.websites.length && !this.orcId && !this.scopusId && !this.researcherId}">
          <h3 class="heading--highlight">Links
            <span ?hidden="${!this.canEdit}" style="position: relative;">
              <span class="tooltip edit-websites" data-text="Edit links">
                <ucdlib-icon icon="ucdlib-experts:fa-pen-to-square"
                  @click=${this._editWebsites}>
                </ucdlib-icon>
              </span>
            </span>
          </h3>
          <div class="link-row" ?hidden="${!this.orcId}">
            <ucdlib-icon icon="ucdlib-experts:fa-orcid"></ucdlib-icon>
            <span><a href="https://orcid.org/${this.orcId}">${this.orcId}</a></span>
          </div>
          ${this.scopusIds.map(
          (scopusId) => html`
            <div class="link-row" ?hidden="${!scopusId}">
              <ucdlib-icon icon="ucdlib-experts:scopus"></ucdlib-icon>
              <span><a href="https://www.scopus.com/authid/detail.uri?authorId=${scopusId}">Scopus</a></span>
            </div>
            `
          )}
          <div class="link-row" ?hidden="${!this.researcherId}">
            <ucdlib-icon icon="ucdlib-experts:ai-clarivate"></ucdlib-icon>
            <span><a href="https://www.webofscience.com/wos/author/record/${this.researcherId}">Clarivate</a></span>
          </div>

          ${this.websites.map(
          (site) => html`
          <div class="link-row">
            <ucdlib-icon icon="ucdlib-experts:${site.icon ? site.icon : 'fa-network-wired'}"></ucdlib-icon>
            <span><a href="${site.url}">${site.name || site.url}</a></span>
          </div>
          `
        )}
        </div>
      </div>

      <div class="grants-abbreviated" ?hidden="${this.grants.length === 0 && (!this.canEdit || this.totalGrants === 0)}">
        <div class="grants-heading">
          <div style="display: flex; align-items: center;">
            <ucdlib-icon class="file-invoice-dollar" icon="ucdlib-experts:fa-file-invoice-dollar"></ucdlib-icon>
            <h2>${this.grants.length} Grants</h2>
          </div>
          <div class="grants-edit-download" style="display: flex; align-items: center;">
            <span ?hidden="${!this.canEdit}" style="position: relative;">
              <span class="tooltip edit-grants" data-text="Edit grants">
                <ucdlib-icon style="margin-right: 1rem;"
                  icon="ucdlib-experts:fa-pen-to-square"
                  @click=${this._editGrants}>
                </ucdlib-icon>
              </span>
            </span>

            <span ?hidden="${!this.canEdit}" style="position: relative;">
              <span class="tooltip download-all-grants" data-text="Download all grants">
                <ucdlib-icon icon="ucdlib-experts:fa-cloud-arrow-down"
                  @click=${this._downloadGrants}>
                </ucdlib-icon>
              </span>
            </span>
          </div>
        </div>
        <span class="hidden-grants-label" ?hidden="${this.totalGrants === this.grants.length || !this.canEdit}">
          ${this.totalGrants - this.grants.length} additional grant${this.totalGrants - this.grants.length === 1 ? ' is' : 's are'} hidden and may be accessed via editing mode
        </span>

        <hr class="seperator">
        ${this.grantsActiveDisplayed.map(
          (grant, index) => html`
            <h3 class="heading--highlight" style="margin: 1.19rem 0;"><span ?hidden="${index > 0}">Active</span></h3>
            <div class="grant">
              <h5>${unsafeHTML(grant.name)}</h5>
              <div class="grant-details">
                <span style="min-width: fit-content;">${grant.start} - ${grant.end}</span>
                <span class="dot">.</span>
                <span style="min-width: fit-content;">${grant.role}</span>
                <span class="dot">.</span>
                <span style="min-width: fit-content;">Awarded by ${grant.awardedBy}</span>
              </div>
            </div>
            <br>
          `
        )}
        ${this.grantsCompletedDisplayed.map(
          (grant, index) => html`
            <h3 class="heading--highlight" style="margin: 1.19rem 0;"><span ?hidden="${index > 0}">Completed</span></h3>
            <div class="grant">
              <h5>${unsafeHTML(grant.name)}</h5>
              <div class="grant-details">
                <span style="min-width: fit-content;">${grant.start} - ${grant.end}</span>
                <span class="dot">.</span>
                <span style="min-width: fit-content;">${grant.role}</span>
                <span class="dot">.</span>
                <span style="min-width: fit-content;">Awarded by ${grant.awardedBy}</span>
              </div>
            </div>
            <br>
          `
        )}
        <div class="see-all-grants" ?hidden= "${this.grants.length < this.grantsPerPage + 1}" @click="${this._seeAllGrants}">
          <ucdlib-icon icon="ucdlib-experts:fa-circle-chevron-right"></ucdlib-icon>
          <span>SEE ALL ${this.grants.length} GRANTS</span>
        </div>
      </div>

      <div class="works-abbreviated" ?hidden="${this.citations.length === 0 && (!this.canEdit || this.totalCitations === 0)}">
        <div class="works-heading">
          <div style="display: flex; align-items: center;">
            <ucdlib-icon class="address-card" icon="ucdlib-experts:fa-book-open"></ucdlib-icon>
            <h2>${this.citations.length} Works</h2>
          </div>
          <div class="works-edit-download" style="display: flex; align-items: center;">
            <span ?hidden="${!this.canEdit}" style="position: relative;">
              <span class="tooltip edit-works" data-text="Edit works">
                <ucdlib-icon style="margin-right: 1rem;"
                  icon="ucdlib-experts:fa-pen-to-square"
                  @click=${this._editWorks}>
                </ucdlib-icon>
              </span>
            </span>

            <span ?hidden="${!this.canEdit}" style="position: relative;">
              <span class="tooltip download-all-works" data-text="Download all works">
                <ucdlib-icon icon="ucdlib-experts:fa-cloud-arrow-down"
                  @click=${this._downloadWorks}>
                </ucdlib-icon>
              </span>
            </span>
          </div>
        </div>
        <span class="hidden-works-label" ?hidden="${this.totalCitations === this.citations.length || !this.canEdit}">
          ${this.totalCitations - this.citations.length} additional work${this.totalCitations - this.citations.length === 1 ? ' is' : 's are'} hidden and may be accessed via editing mode
        </span>

        <hr class="seperator">
        ${this.citationsDisplayed.map(
          (cite) => html`
            <h3 class="heading--highlight" style="margin: 1.19rem 0;">${cite.issued?.[0]}</h3>
            <div class="work">
              <h5>${unsafeHTML(cite.title || cite['container-title'])}</h5>
              <div class="work-details">
                <span style="min-width: fit-content;">${utils.getCitationType(cite.type)}</span>
                <span class="dot">.</span>
                ${unsafeHTML(cite.apa?.replace('(n.d.). ', '')?.replace('(n.d.).', '') || 'Cannot format citation. Contact your <a href="mailto:experts@library.ucdavis.edu">Aggie Experts administrator.</a>')}
              </div>
            </div>
            <br>
          `
        )}
        <div class="see-all-works" ?hidden= "${this.citations.length < this.worksPerPage + 1}" @click="${this._seeAllWorks}">
          <ucdlib-icon icon="ucdlib-experts:fa-circle-chevron-right"></ucdlib-icon>
          <span>SEE ALL ${this.citations.length} WORKS</span>
        </div>
      </div>
    </div>
  </div>
`;}
