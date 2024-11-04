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


      <!-- TODO how to figure out how to show subFilters and also allow them to be active -->
    <div class="filter-controller">
      ${this.filters.map(
        (f) => html`
          <category-filter-row
            @click="${this._onFilterChange}"
            label="${f.label}"
            type="${f.type}"
            count="${f.count}"
            icon="${f.icon}"
            ?active="${f.active}">
          </category-filter-row>
          ${(f.subFilters || []).map(
            (sf) => html`
              <category-filter-row
                subfilter
                ?hidden="${!f.active && !(f.subFilters || []).some(f => f.active)}"
                @click="${this._onSubFilterChange}"
                label="${sf.label}"
                type="${sf.type}"
                status="${sf.status}"
                count="${sf.count}"
                ?active="${sf.active}">
              </category-filter-row>
            `
          )}
        `
      )}
    </div>
  `;
}
