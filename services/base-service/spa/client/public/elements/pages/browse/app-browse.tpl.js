import { html } from "lit";

export default function render() {
  return html`
    <style>
      [hidden] {
        display: none;
      }
    </style>

    <app-browse-by
      id="person"
      label="Experts"
      ?hidden="${this.page !== "/browse/person"}">
    </app-browse-by>
    <!-- TODO -->
  `;
}
