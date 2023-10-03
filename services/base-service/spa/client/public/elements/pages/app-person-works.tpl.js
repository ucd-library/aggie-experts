import { html } from 'lit';

import { sharedStyles } from '../styles/shared-styles';

export function render() {
return html`
  <style>
    ${sharedStyles}

    :host {
      display: block;
    }

    h1 {
      margin-top: 0.5rem;
      margin-bottom: 0;
      padding-bottom: 0;
      color: var(--color-aggie-blue);
    }

    .hero-main {
      background: url('../images/watercolor-sage-solid.jpg') no-repeat center center;
      background-size: 100% auto;
      background-color: #F2FAF6;
      width: 100%;
      height: 12.25rem;
    }

    .hero-text {
      padding: 2.625rem 2.625rem 4.1875rem 2.625rem
    }

    .hero-text .works {
      display: flex;
      align-items: center;
    }

    .hero-text .works ucdlib-icon {
      width: 1rem;
      height: 1rem;
      fill: var(--color-aggie-gold);
    }

    .works span {
      color: var(--color-black-60);
      padding-left: 0.5rem;
      font-size: 1rem;
      font-weight: bold;
      text-transform: uppercase;
    }

    .return-to-profile {
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    .return-to-profile ucdlib-icon {
      fill: var(--color-aggie-gold);
    }

    .return-to-profile span {
      padding-left: 0.5rem;
      font-weight: bold;
      color: var(--color-aggie-blue-80);
    }

    .main-content {
      width: 60%;
      margin: 0 auto;
      padding-top: 2.38rem;
    }

  </style>

  <div class="content">
    <div class="hero-main site-frame">
      <div class="hero-text">
        <div class="works">
        <ucdlib-icon icon="ucdlib-experts:fa-user"></ucdlib-icon>
        <span>${this.personName}</span>
        </div>
        <h1>${this.citationsCount || 0} Works</h1>
      </div>
    </div>

    <div class="main-content">
      <div class="return-to-profile" ?hidden= "${this.citations.length < 11}" @click="${this._seeAllWorks}">
        <ucdlib-icon icon="ucdlib-experts:fa-circle-chevron-left"></ucdlib-icon>
        <span>RETURN TO PROFILE</span>
      </div>
    </div>
  </div>
`;}
