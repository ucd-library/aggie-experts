import { LitElement } from 'lit';
import {render, styles} from "./edit-work-result-row.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

export default class EditWorkResultRow extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
        cite : { type : Object },
        index : { type : Number },
        showYear : { type : Boolean }
    }
  }

  static get styles() {
    return styles();
  }

  constructor() {
    super();
    this.render = render.bind(this);

    this.cite = {};
    this.index = 0;
    this.showYear = false;
  }

  _getCitationRelationshipId() {
    return this.cite?.relatedBy?.find(r => r?.relates?.includes(this.expertId))?.['@id'];
  }

   _emitEvent(eventName) {
    return (e) => {
      const event = new CustomEvent(eventName, {
        detail: {
          cite: this.cite,
          index: this.index,
          citationId: e.currentTarget.dataset.id,
          checked: e.currentTarget.checked
        },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);
    };
  }
}

customElements.define('edit-work-result-row', EditWorkResultRow);
