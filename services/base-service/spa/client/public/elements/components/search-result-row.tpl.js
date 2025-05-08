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

      .search-result-title ucdlib-icon {
        padding-top: .2rem;
      }

      .search-result-title ucdlib-icon.expert {
        fill: var(--color-aggie-gold);
      }

      .search-result-title ucdlib-icon.grant {
        fill: var(--color-thiebaud-icing);
      }

      .search-result-title ucdlib-icon.work {
        fill: var(--color-sage);
      }

      .search-result-title h4 {
        margin: 0 0.62rem 0.5rem;
        color: var(--ucd-blue-80, #13639E);
        font-size: 1.2rem;
        font-style: normal;
        font-weight: 700;
        line-height: 1.3;
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

      .search-result-matches,
      .search-result-scoring {
        padding-left: 36.406px;
        font-size: .9rem;
        font-style: italic;
        color: #666;
        padding-top: 0.4rem;
      }

      .search-result-matches a {
        color: var(--color-aggie-blue-80);
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
          <ucdlib-icon class="work" ?hidden="${this.resultType !== 'work'}" icon="ucdlib-experts:fa-book-open"></ucdlib-icon>
          <h4><a href="/${this.result.id}">${unsafeHTML(this.result.name) || 'Lastname, Firstname'}</a></h4>
        </div>
        <div class="search-result-download" ?hidden="${this.hideCheckbox}">
          <input type="checkbox" id="select-${this.result.id}" data-id="${this.result.id}" name="select-${this.result.id}" value="select-${this.result.id}" @change="${this._selectResult}">
        </div>
      </div>
      <div ?hidden="${this.result.subtitle.length === 0}" class="search-result-sub-text">${unsafeHTML(this.result.subtitle)}</div>
      <div class="search-result-matches" ?hidden="${this.hideSearchMatches || this.resultType !== 'expert'}">
        <span ?hidden="${this.result.numberOfGrants === 0 && this.result.numberOfWorks === 0}" class="search-matches">Search matches:</span>
        <span ?hidden="${this.result.numberOfGrants === 0}"><a href="" @click="${this._filterByGrants}">${this.result.numberOfGrants} grant${this.result.numberOfGrants > 1 ? 's' : ''}</a></span>
        <span class="dot-separator" ?hidden="${this.result.numberOfGrants === 0 || this.result.numberOfWorks === 0}">.</span>
        <span ?hidden="${this.result.numberOfWorks === 0}"><a href="" @click="${this._filterByWorks}">${this.result.numberOfWorks} work${this.result.numberOfWorks > 1 ? 's' : ''}</a></span>
      </div>
      <div class="search-result-scoring" ?hidden=${!APP_CONFIG.user.admin || this.hideSearchMatches}>
        <div class="search-matches">Search score: ${this.result.searchScore}</div>
        <div class="search-matches">Inner hits: ${this.result.innerHits}</div>        
      </div>
    </div>
  `;
}
