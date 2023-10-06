import { LitElement } from 'lit';
import render from "./app-tou.tpl.js"


export default class AppTou extends LitElement {

  static get properties() {
    return {

    }
  }

  constructor() {
    super();
    this.render = render.bind(this);
  }

}

customElements.define('app-tou', AppTou);
