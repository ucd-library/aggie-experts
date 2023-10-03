import { LitElement } from 'lit';
import {render} from "./app-person-works.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

export default class AppPersonWorks extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      personId : { type : String },
      personName : { type : String },
      citationsCount : { type : Number },
      citations : { type : Array },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'PersonModel');

    this.personId = '';
    this.personName = '';
    this.citationsCount = 0;
    this.citations = [];

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
    if( e.location.page !== 'works' ) return;
    window.scrollTo(0, 0);

    let personId = e.location.pathname.substr(1);
    if( personId === this.personId ) return;

    this._onPersonUpdate(await this.PersonModel.get(personId));
  }

  /**
   * @method _onPersonUpdate
   * @description bound to PersonModel person-update event
   *
   * @return {Object} e
   */
  async _onPersonUpdate(e) {
    if( e.state !== 'loaded' ) return;
    if( e.id === this.personId ) return;

    this.citations = e.payload.citations || [];
    this.citationsCount = this.citations.length;

    this.personId = e.id;

    let graphRoot = e.payload['@graph'].filter(item => item['@id'] === this.personId)[0];
    this.personName = graphRoot.name;
  }

}

customElements.define('app-person-works', AppPersonWorks);
