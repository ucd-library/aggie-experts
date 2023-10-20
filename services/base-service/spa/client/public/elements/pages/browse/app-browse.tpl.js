import { html } from "lit";

export default function render() {
  return html`
    <style>
      [hidden] {
        display: none;
      }
    </style>

    <app-browse-by
      id="expert"
      label="Experts"
      ?hidden="${this.page !== "/browse/expert"}">
    </app-browse-by>
    <!-- TODO -->
  `;
}
