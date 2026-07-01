import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { sharedStyles } from '../styles/shared-styles';
import buttonsCss from '@ucd-lib/theme-sass/2_base_class/_buttons.css';
import layoutCss from '@ucd-lib/theme-sass/5_layout/_index.css';

const CHANGE_TYPE_OPTIONS = [
  'Work visibility could not be updated.',
  'Work could not be rejected.',
  'Work could not be added to highlights.',
  'Work could not be removed from highlights.',
  'Grant visibility could not be updated.',
  'Availability settings could not be updated.'
];

const DAGSTER_DOWN_CHANGE_TYPE_OPTIONS = [
  'Hide a work from my profile',
  'Show a work on my profile',
  'Hide a grant from my profile',
  'Show a grant on my profile',
  'Update my availability settings',
  'Hide or remove my profile',
  'Other'
];

export default function render() {
  return html`
    <style>
      ${sharedStyles}
      ${buttonsCss}
      ${layoutCss}

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
        z-index: 1001;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
      }

      .overlay {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 2rem;
        width: 60%;
        max-width: 650px;
        background-color: white;
        border-radius: 25px;
        overflow: hidden;
      }

      .overlay h4 {
        padding: 0;
        margin: 0;
      }

      .header-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
        margin: -2rem -2rem 0 -2rem;
        padding: 2rem 2rem 1rem 2rem;
        border-top-left-radius: 25px;
        border-top-right-radius: 25px;
      }

      .header-section::after {
        content: '';
        position: absolute;
        left: 2rem;
        right: 2rem;
        bottom: 0;
        border-bottom: 4px dotted var(--color-aggie-gold);
      }

      .header-section ucdlib-icon {
        cursor: pointer;
        fill: var(--color-aggie-blue-80);
      }

      .header-section ucdlib-icon:hover {
        fill: var(--color-aggie-gold);
      }

      .header-section .success-icon {
        fill: #2ecc71;
        width: 1.5rem;
        height: 1.5rem;
        flex-shrink: 0;
        cursor: default;
      }

      .header-section .success-icon:hover {
        fill: #2ecc71;
      }

      .header-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .body-section {
        padding-top: 1rem;
      }

      .body-section p {
        margin-top: 0;
      }

      .field {
        margin-bottom: 1rem;
      }

      .field label {
        display: block;
        font-weight: bold;
        margin-bottom: 0.25rem;
        font-size: 0.9rem;
        color: var(--ucd-blue-100, #022851);
      }

      .field label .optional {
        font-weight: normal;
        color: var(--color-black-60);
      }

      .field .autofill-value {
        font-size: 0.9rem;
        color: var(--color-black-80);
      }

      .field .autofill-value .item-name {
        font-weight: bold;
      }

      .field .required {
        color: var(--secondary-double-decker, #C10230);
      }

      /*
      .autofill-row {
        display: flex;
        gap: 2rem;
        margin-bottom: 1rem;
      }

      .autofill-row .field {
        margin-bottom: 0;
      }
      */

      select {
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.75rem center;
        padding-right: 2rem;
      }

      select, textarea, input[type="text"] {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid var(--color-black-40);
        border-radius: 4px;
        font-size: 0.9rem;
        font-family: inherit;
        box-sizing: border-box;
      }

      textarea::placeholder, input[type="text"]::placeholder {
        font-size: 0.9rem;
        font-family: inherit;
        color: var(--color-black-60);
      }

      textarea {
        min-height: 6rem;
        resize: vertical;
      }

      .footer-section {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        padding-top: 1rem;
        gap: 0.6rem;
      }

      .success-msg {
        padding: 0.75rem 0;
        color: var(--color-aggie-blue);
      }

      .error-msg {
        padding: 0.75rem 0;
        color: var(--secondary-double-decker, #C10230);
        font-size: 0.9rem;
      }

      @media (max-width: 600px) {
        /*.autofill-row {
          flex-direction: column;
          gap: 0.5rem;
        }*/

        .footer-section {
          flex-direction: column-reverse;
          align-items: stretch;
        }

        .footer-section button {
          width: 100%;
        }
      }
    </style>

    ${!this.visible ? '' : html`
    <div class="container">
      <div class="overlay">
        <div class="header-section">
          <div class="header-title">
            ${this.submitted ? html`<ucdlib-icon class="success-icon" icon="ucdlib-experts:fa-check-circle"></ucdlib-icon>` : ''}
            <h4>${this.submitted ? 'Request submitted' : 'Request a Profile Change'}</h4>
          </div>
          <ucdlib-icon icon="ucdlib-experts:fa-xmark" @click="${this._onCancel}"></ucdlib-icon>
        </div>

        ${this.submitted ? html`
          <div class="body-section">
            ${this.dagsterDown ? html`
              <p>The Aggie Experts team has been notified and will make this change when the service is restored.</p>
            ` : html`
              <p><strong>Your change is now live on your Aggie Experts profile.</strong></p>
              <p>The team has been notified and will update the source data when the service is restored.</p>
            `}
          </div>
          <div class="footer-section">
            <button class="btn btn--primary" @click="${this._onCancel}">OK</button>
          </div>
        ` : html`
          <div class="body-section">
            <p>${this.dagsterDown
              ? 'Submit this form for urgent profile changes. The Aggie Experts team will process your request as soon as the service is restored.'
              : "Your change couldn't be saved to the source data. Submit this form to update your profile now — the team will fix the source data when the service is restored."
            }</p>

            <div class="l-2col">
              <div class="field l-first">
                <label>Name</label>
                <div class="autofill-value">${this.userName}</div>
              </div>
              <div class="field l-second">
                <label>Email</label>
                <div class="autofill-value">${this.userEmail}</div>
              </div>
            </div>

            ${this.itemName ? html`
              <div class="field">
                <label>${this.itemLabel || 'Item'}</label>
                <div class="autofill-value">
                  <span class="item-name">${this.itemName}</span> ${this.itemSubtext ? html`<span>${unsafeHTML(this.itemSubtext)}</span>` : ''}
                </div>
              </div>
            ` : ''}

            <div class="field">
              <label>What do you need changed? <span class="required">*</span></label>
              <select .value="${this.changeType}" @change="${this._onChangeTypeInput}">
                <option value="" ?selected="${!this.changeType}" disabled>Select a change type</option>
                ${(this.dagsterDown ? DAGSTER_DOWN_CHANGE_TYPE_OPTIONS : CHANGE_TYPE_OPTIONS).map(opt => html`
                  <option value="${opt}" ?selected="${this.changeType === opt}">${opt}</option>
                `)}
              </select>
            </div>

            ${this.dagsterDown && this.searchLabel ? html`
              <div class="field">
                <label>${this.searchLabel} <span class="required">*</span></label>
                <input
                  type="text"
                  placeholder="${this.searchLabel === 'Which work?' ? 'Work name' : 'Grant name'}"
                  .value="${this.searchQuery}"
                  @input="${this._onSearchInput}">
              </div>
            ` : ''}

            <div class="field">
              <label>Additional notes <span class="optional">(optional)</span></label>
              <textarea
                placeholder="Any urgency or additional context..."
                .value="${this.additionalNotes}"
                @input="${this._onNotesInput}">
              </textarea>
            </div>

            ${this.submitError ? html`
              <p class="error-msg">Something went wrong. Please try again or email <a href="mailto:experts@ucdavis.edu">experts@ucdavis.edu</a> directly.</p>
            ` : ''}
          </div>

          <div class="footer-section">
            <button class="btn btn--invert" @click="${this._onCancel}" ?disabled="${this.submitting}">Cancel</button>
            <button class="btn btn--primary" @click="${this._onSubmit}" ?disabled="${this.submitting}">
              ${this.submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        `}
      </div>
    </div>
    `}
  `;
}
