import { LitElement } from 'lit';
import {render} from "./app-browse-by.tpl.js";

import '../../components/ucdlib-browse-az.js';

export default class AppBrowseBy extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      id : { type : String },
      displayedResults : { type : Array },
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);

    this.id = '';
    this.displayedResults = [];

    this._injectModel('AppStateModel');
  }

  async firstUpdated() {
    this.displayedResults = [1,2,3,4,5,6,7,8,9,10];
    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @param {Object} e
   * @returns {Promise}
   */
  _onAppStateUpdate(e) {
    if( e.location.page !== 'browse' ) return;
    if( e.location.path.length < 2 ) return;
    if( e.location.path[1] !== this.id ) return; // the page

    this.id = e.location.path[1];
  }
}

customElements.define('app-browse-by', AppBrowseBy);
