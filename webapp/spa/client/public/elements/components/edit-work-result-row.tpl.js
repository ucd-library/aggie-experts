import { html, css } from 'lit';

import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import utils from '../../lib/utils';

export function styles() {
  const elementStyles = css`
    :host {
      display: block;
    }

    [hidden] {
      display: none !important;
    }

    .work-results {
      display: flex;
      justify-content: space-between;
      margin: 1.19rem 0;
    }

    .not-visible h5,
    .not-visible .work-details {
      font-style: italic;
    }

    .not-visible .work h5 {
      color: var(--ucd-black-60, #7F7F7F);
    }

    .not-visible .work-details {
      color: var(--ucd-black-50, #999);
    }

    .work-details .dot {
      padding: 0 0.25rem;
    }

    .hide-delete-btn-group {
      display: flex;
      align-items: flex-start;
      padding-top: .25rem;
    }

    .hide-delete-btn-group ucdlib-icon {
      fill: var(--color-aggie-blue-80);
      width: 15px;
      height: 15px;
      min-width: 17px;
      min-height: 17px;
      padding-right: .89rem;
      cursor: pointer;
    }

    .hide-delete-btn-group ucdlib-icon:hover {
      fill: var(--color-aggie-gold);
    }

    .work-details > .csl-bib-body,
    .work-details > .csl-bib-body > .csl-entry {
      display: inline;
      line-height: var(--lh-html);
    }

    .work h5 {
      color: var(--ucd-blue-80, #13639E);
      cursor: pointer;
    }

    .work h5 a {
      text-decoration: none;
      color: var(--ucd-blue-80, #13639E)
    }

    .tooltip {
      cursor: pointer;
    }

    .tooltip:before {
      content: attr(data-text);
      position: absolute;
      bottom: 27px;
      right: -27px;

      width: 90px;
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

    .tooltip:after {
      content: "";
      position: absolute;
      bottom: 17px;
      right: 23px;

      border: 5px solid #000;
      border-color: black transparent transparent transparent;

      opacity: 0;
      transition: .2s opacity ease-out;
    }

    .tooltip:hover:before, .tooltip:hover:after {
      opacity: 1;
    }

    .tooltip.reject-work:before {
      right: -25px;
    }

    .tooltip.reject-work:after {
      right: 21px;
    }

    .tooltip.deselect-favourite:before,
    .tooltip.mark-favourite:before {
      width: 190px;
      right: -140px;
    }

    .work {
      max-width: calc(90vw - 100px);
    }

    .work h5 {
      color: black;
      margin: 0 0 0.5rem 0;
      font-size: 1.2rem;
      line-height: 1.3;
    }

    .works-results > div {
      flex-shrink: 1;
      word-wrap: break-word;
    }

    .select-all,
    .select-checkbox {
      display: flex;
      flex-direction: row-reverse;
      align-items: center;
      padding-top: 1.2rem;
    }

    .select-all {
      display: inline-block;
      padding-top: 0;
    }

    .select-checkbox {
      align-items: flex-start;
      padding-top: 0;
      padding-left: .89rem;
      margin-left: auto;
    }

    .select-all label {
      color: var(--other-h-3-gray, #666);
      font-size: .95rem;
      font-style: normal;
      font-weight: 400;
      line-height: 1.625rem;
      padding-right: .4rem;
      position: relative;
      bottom: .2rem;
    }

    input[type="checkbox"] {
      height: 1rem;
      width: 1rem;
    }
  `;

  return [
    elementStyles,
  ];
}

export function render() {
return html`
  <div class="${!this.cite['is-visible'] ? 'not-visible' : ''} work-results">
    <div class="hide-delete-btn-group">
      <span style="position: relative;">
        <span class="tooltip deselect-favourite" data-text="Remove from Highlights" ?hidden="${!this.cite.favourite}">
          <ucdlib-icon
            ?hidden="${!this.cite.favourite}"
            icon="ucdlib-experts:fa-solid-heart"
            @click=${this._emitEvent('deselect-favourite')}
            @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') this._emitEvent('deselect-favourite')(e); }}
            tabindex="0"
            role="button"
            aria-label="Remove from Highlights"
            data-id="${this._getCitationRelationshipId()}"></ucdlib-icon>
        </span>
        <span class="tooltip mark-favourite" data-text="Add to Highlights" ?hidden="${this.cite.favourite}">
          <ucdlib-icon
            ?hidden="${this.cite.favourite}"
            icon="ucdlib-experts:fa-regular-heart"
            @click=${this._emitEvent('mark-favourite')}
            @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') this._emitEvent('mark-favourite')(e); }}
            tabindex="0"
            role="button"
            aria-label="Add to Highlights"
            data-id="${this._getCitationRelationshipId()}"></ucdlib-icon>
        </span>
      </span>
      <span style="position: relative;">
        <span class="tooltip hide-work" data-text="Hide work">
          <ucdlib-icon
            ?hidden="${!this.cite['is-visible']}"
            icon="ucdlib-experts:fa-eye"
            @click=${this._emitEvent('hide-work')}
            @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') this._emitEvent('hide-work')(e); }}
            tabindex="0"
            role="button"
            aria-label="Hide work"
            data-id="${this._getCitationRelationshipId()}"></ucdlib-icon>
        </span>
        <span class="tooltip show-work" data-text="Show work">
          <ucdlib-icon
            ?hidden="${this.cite['is-visible']}"
            icon="ucdlib-experts:fa-eye-slash"
            @click=${this._emitEvent('show-work')}
            @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') this._emitEvent('show-work')(e); }}
            tabindex="0"
            role="button"
            aria-label="Show work"
            data-id="${this._getCitationRelationshipId()}"></ucdlib-icon>
        </span>
      </span>
      <span style="position: relative;">
        <span class="tooltip reject-work" data-text="Reject work">
          <ucdlib-icon
            icon="ucdlib-experts:fa-trash"
            @click=${this._emitEvent('reject-work')}
            @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') this._emitEvent('reject-work')(e); }}
            tabindex="0"
            role="button"
            aria-label="Reject work"
            data-id="${this._getCitationRelationshipId()}"></ucdlib-icon>
        </span>
      </span>
    </div>
    <div class="work">
      <h5><a href="/work/${this.cite['@id']}">${unsafeHTML(this.cite.title || this.cite['container-title'])}</a></h5>
      <div class="work-details">
        <span ?hidden="${!this.showYear}" style="min-width: fit-content;">${this.cite.originalIssued?.[0]}</span>
        <span ?hidden="${!this.showYear}" class="dot">•</span>
        <span style="min-width: fit-content;">${utils.getCitationType(this.cite.type)}</span>
        <span class="dot">•</span>
        ${unsafeHTML(this.cite.apa?.replace('(n.d.). ', '')?.replace('(n.d.).', '') || 'Cannot format citation. Contact your <a href="mailto:experts@ucdavis.edu">Aggie Experts administrator.</a>')}
      </div>
    </div>
    <div class="select-checkbox">
      <input type="checkbox"
        data-id="${this.cite['@id']}"
        id="select-${this.index}"
        name="select-${this.index}"
        value="select-${this.index}"
        @click="${this._emitEvent('select-checked')}">
    </div>
  </div>
`;}
