import { html, css } from "lit";

export function styles() {
  const elementStyles = css`
    :host {
      display: block;
    }

    [hidden] {
      display: none !important;
    }

    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .result-title {
      display: flex;
      align-items: center;
    }

    .result-title ucdlib-icon {
      fill: var(--color-aggie-gold);
    }
    .result-title h4 {
      margin: 0 0.62rem .5rem;
      /* color: var(--ucd-blue-80, #13639E); */
      font-size: 1.2rem;
      font-style: normal;
      font-weight: 700;
      line-height: 1.3;
      text-transform: capitalize;
    }

    .result-title h4 a {
      text-decoration: none;
      color: var(--ucd-blue-80, #13639E);
    }

    .result-title h4 a:hover {
      text-decoration: underline;
    }

    .result-sub-text {
      padding-left: 36.406px;
      /* text-transform: lowercase; */
    }

    .result-matches {
      padding-left: 36.406px;
      font-size: .9rem;
      font-style: italic;
      color: #666;
      padding-top: 0.4rem;
    }

    .matches {
      padding-right: .25rem;
    }

    .dot-separator {
      font-weight: bold;
      position: relative;
      bottom: 0.15rem;
      padding: 0.25rem;
    }
  `;

  return [elementStyles];
}

export function render() {
  return html`
    <div class="result">
      <div class="result-header">
        <div class="result-title">
          <ucdlib-icon icon="ucdlib-experts:fa-user"></ucdlib-icon>
          <h4>
            <a ?hidden="${!this.result.hasProfile}" href="/${this.result.id}">${this.result.name || 'Lastname, Firstname'}</a>
            <span ?hidden="${this.result.hasProfile}" id="${this.result.id}">${this.result.name || 'Lastname, Firstname'}</span>
          </h4>
        </div>
      </div>
      <div ?hidden="${this.result.subtitle.length === 0}" class="result-sub-text">${this.result.subtitle}</div>
    </div>
  `;
}
