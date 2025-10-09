import { LitElement, html, css } from 'lit';

export class ShareButton extends LitElement {
  static get properties() {
    return {
      showCopyLinkOverlay: { type: Boolean }
    };
  }

  constructor() {
    super();
    this.showCopyLinkOverlay = false;
    this._handleDismissCopyLinkClick = this._handleDismissCopyLinkClick.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._handleDismissCopyLinkClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._handleDismissCopyLinkClick);
  }

  static get styles() {
    return css`
      :host {
        margin-left: auto;
        align-items: center;
        cursor: pointer;
        display: flex;
        justify-content: center;
        position: relative;
      }

      [hidden] {
        display: none !important;
      }

      .share-container {
        margin-left: auto;
        align-items: center;
        cursor: pointer;
        display: flex;
        justify-content: center;
        position: relative;
      }

      .tooltip.share ucdlib-icon {
        fill: var(--color-aggie-blue-80);
      }

      .tooltip.share:hover ucdlib-icon {
        fill: var(--color-aggie-gold);
      }

      .copy-link-overlay {
        position: absolute;
        right: 1rem;
        top: 2rem;
        display: flex;
        cursor: pointer;
        color: var(--color-aggie-blue-80);
        background-color: var(--color-aggie-blue-30);
        width: fit-content;
        white-space: nowrap;
        align-items: center;
        padding: 0.875rem 0.875rem 0.875rem 0.5rem;
      }

      .copy-link-overlay:hover {
        background-color: var(--color-aggie-blue-40);
      }

      .copy-link-overlay ucdlib-icon {
        width: 40px;
      }

      .copy-link-overlay span {
        color: var(--color-aggie-blue);
        font-weight: normal;
      }
    `;
  }

  render() {
    return html`
      <div class="share-container" @click="${this._shareLinkClick}">
        <span class="tooltip share" data-text="Share">
          <ucdlib-icon icon="ucdlib-experts:fa-share"></ucdlib-icon>
        </span>
        <div
          class="copy-link-overlay"
          @click="${this._copyLinkClick}"
          ?hidden="${!this.showCopyLinkOverlay}"
        >
          <ucdlib-icon icon="ucdlib-experts:fa-link"></ucdlib-icon>
          <span>Copy Link</span>
        </div>
      </div>
    `;
  }

  _shareLinkClick(e) {
    e.stopPropagation();
    this.showCopyLinkOverlay = !this.showCopyLinkOverlay;
  }

  _copyLinkClick(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(window.location.href);
    this._dismissOverlay();
  }

  _handleDismissCopyLinkClick(event) {
    const overlay = this.shadowRoot.querySelector('.copy-link-overlay');
    const path = event.composedPath();
    if (overlay && !path.includes(overlay) && this.showCopyLinkOverlay) {
      this._dismissOverlay();
    }
  }

  _dismissOverlay() {
    this.showCopyLinkOverlay = false;
  }
}

customElements.define('share-button', ShareButton);
