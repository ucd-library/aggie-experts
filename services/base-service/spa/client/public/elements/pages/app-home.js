import { LitElement } from 'lit';
import {render} from "./app-home.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

import "../components/search-box";

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

  /**
   * @method _onSearch
   * @description called from the search box button is clicked or
   * the enter key is hit. search
   * @param {Object} e
   */
  _onSearch(e) {
    // let searchDoc = this.RecordModel.emptySearchDocument();
    // this.RecordModel.setTextFilter(searchDoc, e.detail);
    // this.RecordModel.setSearchLocation(searchDoc);

    // TODO determine search payload we need to send, how complicated should url params be?
    if( e.detail.length ) this.AppStateModel.setLocation('/search/'+e.detail);
  }

}

customElements.define('app-home', AppHome);
