import { LitElement } from 'lit';
import {render} from "./app-search-tips.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

export default class AppSearchTips extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {}
  }

  constructor() {
    super();
    this._injectModel('AppStateModel');

    this.render = render.bind(this);
  }

  async firstUpdated() {
    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @return {Object} e
   */
  async _onAppStateUpdate(e) {
    if( e.location.page !== 'search-tips' ) return;
  }

}

customElements.define('app-search-tips', AppSearchTips);
