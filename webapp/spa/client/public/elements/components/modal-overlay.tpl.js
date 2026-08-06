import { html } from "lit";
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import { sharedStyles } from '../styles/shared-styles';
import buttonsCss from "@ucd-lib/theme-sass/2_base_class/_buttons.css";

export default function render() {
  return html`
    <style>
      ${sharedStyles}
      ${buttonsCss}

      :host {
        display: block;
      }

      [hidden] {
        display: none !important;
      }

      .container {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 1000;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
      }

      /*
      .container.error-mode .overlay {
        background-color: var(--color-double-decker);
      }

      .container.error-mode .overlay h4,
      .container.error-mode .overlay p,
      .container.error-mode .overlay a {
        color: white;
      }

      .container.error-mode .overlay .header-section ucdlib-icon {
        fill: white;
      }
      */

      .container.error-mode .overlay h4 {
        color: var(--secondary-double-decker, #C10230);
      }

      .container.error-mode .overlay .header-section {
        border-bottom: none;
        background-color: #FFE6E7;
      }

      .container.error-mode .overlay .header-section::after {
        content: none;
      }

      .container.error-mode .overlay .header-section h4 {
        display: flex;
      }
      
      .container.error-mode .overlay .header-section .error-icon {
        fill: var(--secondary-double-decker, #C10230);    
        height: 2rem;
        width: 2rem;
        padding-right: .5rem;  
      }

      .overlay {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 2rem;
        justify-content: center;
        align-items: center;
        width: 60%;
        margin: auto;
        max-width: 650px;
        background-color: white;
        border-radius: 25px;
        overflow: hidden;
      }

      .overlay h4 {
        padding: 0;
        margin: 0;
      }

      .overlay .header-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
        margin: -2rem -2rem 0 -2rem;
        padding: 2rem 2rem 1rem 2rem;
        padding-bottom: 1rem;
        border-top-left-radius: 25px;
        border-top-right-radius: 25px;
      }

      .overlay .header-section::after {
        content: '';
        position: absolute;
        left: 2rem;
        right: 2rem;
        bottom: 0;
        border-bottom: 4px dotted var(--color-aggie-gold);
      }

      .overlay .header-section ucdlib-icon {
        cursor: pointer;
        fill: var(--color-aggie-blue-80);
      }

      .overlay .header-section ucdlib-icon:hover {
        fill: var(--color-aggie-gold);
      }

      .overlay .footer-section {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        padding-top: 1rem;
      }

      .overlay .footer-buttons button {
        font-size: .9rem;
        margin-left: .6rem;
      }

      .footer-buttons a.btn--primary {
        padding-top: 0;
        padding-bottom: 0;
        margin-left: 0.5rem;
        font-size: .9rem;
      }

      button.ok {
        min-width: 70px;
        max-width: 70px;
        padding-left: 1rem;
      }

      @media (max-width: 600px) {
        .overlay .footer-section {
          display: block;
        }

        .overlay .footer-section .footer-buttons {
          display: flex;
          flex-direction: column-reverse;
        }

        .overlay .footer-buttons button {
          margin-left: 0;
          display: block;
          width: 100%;
          margin-top: 1rem;
        }

        .btn--primary:before,
        .btn--invert:before {
          padding-right: .3rem;
        }
      }

      input[type="checkbox"] {
        height: 1rem;
        width: 1rem;
      }

      .body-section {
        padding-top: 1rem;
      }
    </style>

    ${!this.visible ? '' : html`
    <div class="container${this.errorMode ? ' error-mode' : ''}">
      <div class="overlay">
        <div class="header-section">
          <h4>
            <ucdlib-icon icon="ucdlib-experts:fa-exclamation-triangle" ?hidden="${!this.errorMode}" class="error-icon"></ucdlib-icon>  
            ${this.title}
          </h4>
          <ucdlib-icon icon="ucdlib-experts:fa-xmark" @click="${this._onCancel}"></ucdlib-icon>
        </div>
        <div class="body-section" @click="${this._onBodyClick}">
          ${unsafeHTML(this.content)}
        </div>
        <div class="footer-section">
          <div class="footer-buttons">
            <button ?hidden="${this.hideCancel}" class="btn btn--invert" @click="${this._onCancel}">Cancel</button>
            <button ?hidden="${this.hideSave}" class="btn btn--primary" aria-label="${ifDefined(this.saveText.length > 0 ? undefined : `${this.title} in a new tab`)}" @click="${this._onSave}">${this.saveText || this.title}</button>
            <a ?hidden="${this.hideOaPolicyLink}" href="https://oapolicy.universityofcalifornia.edu/listobjects.html?as=3&am=false&cid=1&ipr=false&iqf=true" class="btn btn--primary">${(this.title || '').replace('New ', '')}</a>
            <button ?hidden="${this.hideOK}" class="btn btn--primary ok" @click="${this._onCancel}">OK</button>
          </div>
        </div>
      </div>
    </div>
    `}
  `;
}
