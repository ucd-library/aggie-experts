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

      .root {
        display: flex;
        align-items: center;
      }

      input {
        width: 100%;
        box-sizing: border-box;
        padding: 1rem;
        background: white;
        border: none;
        height: 61px;
        outline: none;
        font-size: 1rem;
        font-family: proxima-nova, "Helvetica Neue", Helvetica, Arial,
          sans-serif;
        font-weight: 500;
      }

      input::placeholder {
        color: var(--color-aggie-blue-70);
      }

      button {
        background: var(--color-aggie-gold);
        height: 61px;
        width: 61px;
        border: none;
        margin: 0;
        padding: 0 10px;
        border-radius: 0;
        cursor: pointer;
      }

      button.rounded {
        border-radius: 50%;
        position: relative;
        right: 61px;
        background-color: var(--color-aggie-blue-80);
        width: 50px;
        height: 50px;
      }

      button.rounded ucdlib-icon {
        fill: white;
      }

      button:hover > ::slotted(*) {
        fill: var(--color-aggie-gold);
      }

      .search-container {
        width: 25rem;
      }

      ucdlib-icon {
        width: 70%;
        height: 70%;
        margin: auto;
      }

      #input {
        border-radius: unset;
      }

      input.gold {
        background: var(--ucd-gold-40, #FFF4D2);
      }
    </style>

    <div class="root search-bar" ?hidden="${this.searchRounded}">
      <div class="search-container" style="flex: 1; display: flex;">
        <input
          id="input"
          class="${this.isGold ? 'gold' : ''}"
          type="text"
          @keyup="${this._onKeyUp}"
          placeholder="${this.placeholder}"
          @change="${this._handleChange}"
          .value="${this.searchTerm}"
        />
      </div>
      <button @click="${this._fireSearch}" class="search-button ${this.searchRounded ? 'rounded' : ''}">
        <ucdlib-icon icon="ucdlib-experts:fa-search"></ucdlib-icon>
      </button>
    </div>

    <div class="root search-bar-block" ?hidden="${!this.searchRounded}">
      <div class="search-container-block" style="display: block; width: 100%; position: relative">
        <input
          id="input"
          class="${this.isGold ? 'gold' : ''}"
          type="text"
          @keyup="${this._onKeyUp}"
          placeholder="${this.placeholder}"
          @change="${this._handleChange}"
          .value="${this.searchTerm}"
        />
        <button @click="${this._fireSearch}"
          class="search-button ${this.searchRounded ? 'rounded' : ''}"
          style="position: absolute; top: 5.5px; right: 0.5rem;">
          <ucdlib-icon icon="ucdlib-experts:fa-search"></ucdlib-icon>
        </button>
      </div>

    </div>
  `;
}
