import { html } from 'lit';

export default function render() {
  const isError = this.type === 'error';

  return html`
    <style>
      :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
      }

      .banner {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 0.65rem 0.9rem;
        font-size: 0.9rem;
        box-sizing: border-box;
        width: 100%;
      }

      .banner.error {
        background-color: #fce8e8;
        border: 1px solid #e8b4b4;
        color: var(--secondary-double-decker, #C10230);
      }

      .banner.info {
        background-color: #ddeef9;
        border: 1px solid #b0d0ed;
        color: var(--color-aggie-blue, #022851);
      }

      .banner-icon {
        flex-shrink: 0;
        width: 1rem;
        height: 1rem;
        margin-top: 0.1rem;
      }

      .banner.error .banner-icon {
        fill: var(--secondary-double-decker, #C10230);
      }

      .banner.info .banner-icon {
        fill: var(--color-aggie-blue, #022851);
      }

      .banner-content {
        flex: 1;
        min-width: 0;
      }

      .banner-title a {
        color: inherit;
        font-weight: bold;
        text-decoration: underline;
      }

      .help-link {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        color: inherit;
        text-decoration: underline;
        cursor: pointer;
      }

      .banner-items {
        margin: 0.25rem 0 0;
        padding-left: 1.25rem;
      }

      .banner-items li em {
        font-style: italic;
      }

      .dismiss-btn {
        flex-shrink: 0;
        cursor: pointer;
        width: 0.9rem;
        height: 0.9rem;
        margin-top: 0.15rem;
        background: none;
        border: none;
        padding: 0;
      }

      .banner.error .dismiss-btn {
        fill: var(--secondary-double-decker, #C10230);
      }

      .banner.info .dismiss-btn {
        fill: var(--ucd-blue-100, #022851);
      }

      /* slotted content for custom/freeform use */
      ::slotted(a) {
        color: inherit;
        font-weight: bold;
        text-decoration: underline;
      }

      ::slotted(ul) {
        margin: 0.25rem 0 0;
        padding-left: 1.25rem;
      }
    </style>

    <div class="banner ${isError ? 'error' : 'info'}">
      ${this.icon ? html`
        <ucdlib-icon class="banner-icon" icon="${this.icon}"></ucdlib-icon>
      ` : ''}

      <div class="banner-content">
        ${this.message ? html`
          <span>
            ${this.message}
            ${this.showHelp ? html` <button class="help-link" @click=${this._onHelp}>get help</button>.` : ''}
          </span>
        ` : ''}

        ${this.titleLabel ? html`
          <span class="banner-title">
            Recent updates to
            ${this.titleHref
              ? html`<a href="${this.titleHref}">${this.titleLabel}</a>`
              : this.titleLabel}
            ${this.titleSuffix || ''}
          </span>
        ` : ''}

        ${this.items?.length ? html`
          <ul class="banner-items">
            ${this.items.map(item => html`
              <li>
                ${item.label ? html`<em>${item.label}</em>` : ''}${item.subtext ? html` <span>${item.subtext}</span>` : ''}
              </li>
            `)}
          </ul>
        ` : ''}

        <slot></slot>
      </div>

      ${this.dismissible ? html`
        <ucdlib-icon
          class="dismiss-btn"
          icon="ucdlib-experts:fa-xmark"
          title="Dismiss"
          role="button"
          tabindex="0"
          @click=${this._onDismiss}
          @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') this._onDismiss(); }}>
        </ucdlib-icon>
      ` : ''}
    </div>
  `;
}
