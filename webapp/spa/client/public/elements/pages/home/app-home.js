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
    let searchBox = this.shadowRoot.querySelector('#searchBox');
    if( searchBox ) searchBox.searchTerm = '';

    // Navigate to the search page BEFORE flagging resetSearch (matches the header search in
    // fin-app). Setting resetSearch while still on '/home' leaves the flag unconsumed — the
    // search page ignores non-search app-state-updates — so it lingers and gets applied later
    // (e.g. after the user expands and adjusts the Date filter), collapsing the sidebar.
    const term = e.detail?.trim();
    if( term ) {
      this.AppStateModel.setLocation('/search/'+encodeURIComponent(term));
      this.AppStateModel.set({ resetSearch: true });
    }
  }

}

customElements.define('app-home', AppHome);
