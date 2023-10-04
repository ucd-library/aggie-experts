import { LitElement } from 'lit';
import render from "./app-404.tpl.js";


export default class App404 extends LitElement {

  static get properties() {
    return {

    };
  }

  constructor() {
    super();
    this.render = render.bind(this);
  }

}

customElements.define('app-404', App404);
