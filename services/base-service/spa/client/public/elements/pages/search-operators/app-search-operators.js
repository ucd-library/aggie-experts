import { LitElement } from 'lit';
import {render} from "./app-search-operators.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

export default class AppSearchOperators extends Mixin(LitElement)
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
    if( e.location.page !== 'search-operators' ) return;
  }

}

customElements.define('app-search-operators', AppSearchOperators);
