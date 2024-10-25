import { html } from "lit";

export default function render() {
  return html`
    <style>
      [hidden] {
        display: none;
      }
    </style>

    <app-browse-by
      browse-type="${this.browseType}"
      letter="${this.letter}">
    </app-browse-by>
  `;
}
