import { html } from "lit";

export default function render() {
  return html`
    <style include="shared-styles">
      :host {
        display: block;
      }

      [hidden] {
        display: none !important;
      }

      .filter-result {
        display: flex;
        align-items: center;
        padding: 0 0.59375rem;
        height: 52px;
        position: relative;
      }

      .filter-result.active,
      .filter-result.active .label,
      .filter-result.active .count {
        background: var(--color-aggie-blue-80, #13639E);
        color: white !important;
      }

      .filter-result.active.mobile .label,
      .filter-result.active.mobile .count {
        background: transparent;
      }

      .filter-result .count {
        margin-left: auto;
      }

      .filter-result .label {
        padding-left: .56rem;
        font-weight: bold;
      }

      .filter-result ucdlib-icon {
        fill: var(--color-aggie-blue-60, #73ABDD);
      }

      .filter-result.active ucdlib-icon {
        fill: white;
      }

      .filter-result svg {
        flex-shrink: 0;
        align-self: stretch;
        fill: var(--color-aggie-blue-80, #13639E);
        position: absolute;
        right: -17px;
      }

      .filter-result.active svg,
      .filter-result:hover svg {
        display: initial !important;
      }

      .filter-result:not(.active):hover {
        background: var(--color-aggie-blue-40);
      }

      .filter-result:not(.active):hover svg path {
        fill: var(--color-aggie-blue-40);
      }

      .filter-result.subfilter .label,
      .filter-result.subfilter .count {
        font-weight: normal;
        color: var(--color-aggie-blue-80);
      }

      @media (max-width: 767px) {
        .filter-result.active svg,
        .filter-result:hover svg {
          display: none !important;
        }

        .filter-result.active {
          background: var(--ucd-blue-100, #022851);
        }
      }
    </style>

    <div class="filter-result ${this.active ? 'active' : ''} ${this.subfilter ? 'subfilter' : ''} ${this.mobile ? 'mobile' : ''}">
      <ucdlib-icon icon="ucdlib-experts:${this.icon}"></ucdlib-icon>
      <p class="label">${this.label}</p>
      <p class="count">${this.count}</p>
      <svg style="display: none" xmlns="http://www.w3.org/2000/svg" width="17" height="52" viewBox="0 0 17 52" fill="none">
        <path d="M17 26L-3.21932e-07 51.5L1.90735e-06 0.499999L17 26Z" fill="#13639E"/>
      </svg>
    </div>

  `;
}
