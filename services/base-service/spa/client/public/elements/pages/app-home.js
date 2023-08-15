import { LitElement } from 'lit';
import {render} from "./app-home.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

export default class AppHome extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      // page: { type: String },
      // imageSrc: { type: String },
      // imageAltText: { type: String },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel');

    this.render = render.bind(this);
  }

}

customElements.define('app-home', AppHome);
