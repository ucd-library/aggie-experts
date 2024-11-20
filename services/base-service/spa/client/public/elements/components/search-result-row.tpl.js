import { html } from "lit";
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

export default function render() {
  return html`
    <style include="shared-styles">
      :host {
        display: block;
      }

      [hidden] {
        display: none !important;
      }

      .search-result-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .search-result-title {
        display: flex;
        align-items: flex-start
      }

      .search-result-title ucdlib-icon.expert {
        fill: var(--color-aggie-gold);
        padding-top: .2rem;
      }

      .search-result-title ucdlib-icon.grant {
        fill: var(--color-thiebaud-icing);
        padding-top: .2rem;
      }

      .search-result-title h4 {
        margin: 0 0.62rem 0.5rem;
        color: var(--ucd-blue-80, #13639E);
        font-size: 1.43375rem;
        font-style: normal;
        font-weight: 700;
        line-height: 1.71875rem;
        text-transform: capitalize;
      }

      .search-result-title h4 a {
        text-decoration: none;
        color: var(--ucd-blue-80, #13639E);
      }

      .search-result-title h4 a:hover {
        text-decoration: underline;
      }

      .search-result-sub-text {
        padding-left: 36.406px;
        /* text-transform: lowercase; */
      }

      /* .search-result-sub-text::first-letter {
        text-transform: uppercase;
      } */

      .search-result-matches {
        padding-left: 36.406px;
        font-size: .9rem;
        font-style: italic;
        color: #666;
        padding-top: 0.4rem;
      }

      .search-matches {
        padding-right: .25rem;
      }

      .dot-separator {
        font-weight: bold;
        position: relative;
        bottom: 0.15rem;
        padding: 0.25rem;
      }

      input[type="checkbox"] {
        height: 1rem;
        width: 1rem;
      }

    </style>

    <div class="search-result">
      <div class="search-result-header">
        <div class="search-result-title">
          <ucdlib-icon class="expert" ?hidden="${this.resultType !== 'expert'}" icon="ucdlib-experts:fa-user"></ucdlib-icon>
          <ucdlib-icon class="grant" ?hidden="${this.resultType !== 'grant'}" icon="ucdlib-experts:fa-file-invoice-dollar"></ucdlib-icon>
          <h4><a href="/${this.result.id}">${this.result.name || 'Lastname, Firstname'}</a></h4>
        </div>
        <div class="search-result-download" ?hidden="${this.hideCheckbox}">
          <input type="checkbox" id="select-${this.result.id}" name="select-${this.result.id}" value="select-${this.result.id}">
        </div>
      </div>
      <div ?hidden="${this.result.subtitle.length === 0}" class="search-result-sub-text">${unsafeHTML(this.result.subtitle)}</div>
      <div class="search-result-matches" ?hidden="${this.hideSearchMatches}">
        <span class="search-matches">Search matches:</span>
          <span>${this.result.numberOfGrants} grants</span>
          <span class="dot-separator">.</span>
          <span>${this.result.numberOfWorks} works</span>
      </div>
    </div>
  `;
}
