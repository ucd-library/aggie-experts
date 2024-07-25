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
    </style>

    <div class="filter-controller">
      ${this.filters.map(
        (f) => html`
          <category-filter-row @click="${this._onFilterChange}" label="${f.label}" count="${f.count}" icon="${f.icon}" ?active="${f.active}"></category-filter-row>
        `
      )}
    </div>
  `;
}
