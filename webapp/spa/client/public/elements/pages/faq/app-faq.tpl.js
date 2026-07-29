import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { sharedStyles } from '../../styles/shared-styles';

export function render() {
return html`
  <style>
    ${sharedStyles}
    :host {
      display: block;
    }

    .faq-header {
      width: 100%;
      display: flex;
      align-items: center;
      height: 75px;
      border-bottom: solid 1px #E5E5E5;
    }

    .faq-header .faq-label {
      color: var(--ucd-blue-100, #022851);
      font-size: 2.5rem;
      font-style: normal;
      font-weight: 700;
      line-height: 2.5rem;
      padding-right: .7rem;
      padding-left: .7rem;
    }
    svg {
      width: 20.22471911px;
      height: 75px;
    }

    .faq .section {
      display: block;
      width: 53.5rem;
      padding: 3rem 0rem 4.1875rem 0rem;
      margin: 0 auto;
    }

    .faq .section img {
      max-width: 100%;
    }

    .faq .section h2 {
      color: var(--color-black-60);
    }

    @media (max-width: 992px) {
      .faq .section {
        width: 90%;
      }
    }

  </style>

  <div class="faq-header">
    <div class="faq-label">Help</div>
    <div style="display: flex; height: 75px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none">
        <path d="M21.6 0L0 89H24V0H21.6Z" fill="#DBEAF7"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="89" viewBox="0 0 24 89" fill="none" style="position: relative; left: -1px">
        <path d="M2.4 89L24 0H0V89H2.4Z" fill="#DBEAF7"/>
      </svg>
    </div>
  </div>
  <div class="faq container top">
    <div class="section">
      ${!this.faqLoaded ? html`<p>Loading FAQ...</p>` : ''}
      ${this.faqLoadError ? html`<p>${this.faqLoadError}</p>` : ''}

      ${this.faqSections.map(section => html`
        <h2 id="${section.id}">${section.title}</h2>
        ${section.introHtml ? html`<div class="faq-intro">${unsafeHTML(section.introHtml)}</div>` : ''}
        <ucd-theme-list-accordion>
          ${section.items.map(item => html`
            <li id="${item.id}">${item.question}</li>
            <li>
              <div class="faq-answer" @click="${this._onFaqContentClick}">
                ${unsafeHTML(item.answerHtml)}
              </div>
            </li>
          `)}
        </ucd-theme-list-accordion>
      `)}
    </div>
  </div>

`;}
