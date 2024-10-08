import { LitElement } from 'lit';
import {render} from "./app-home.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../../utils/app-icons.js';

import "../../components/search-box";

export default class AppHome extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {}
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
    if( e.detail?.trim().length ) this.AppStateModel.setLocation('/search/'+encodeURIComponent(e.detail.trim()));
  }

}

customElements.define('app-home', AppHome);
