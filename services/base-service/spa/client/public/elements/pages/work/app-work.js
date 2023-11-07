import { LitElement } from 'lit';
import {render} from "./app-work.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

import '@ucd-lib/theme-elements/ucdlib/ucdlib-md/ucdlib-md.js';
import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../utils/app-icons.js';

export default class AppWork extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      workId : { type : String },
      work : { type : Object },
      publicationName : { type : String },
      authors : { type : Array },
      ucTextLink : { type : String },
      pubPageTextLink : { type : String },
      abstract : { type : String },

    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'WorkModel');

    this.workId = '';
    this.work = {};

    this.render = render.bind(this);
  }

  async firstUpdated() {
    if( this.workId && this.workId === 'ark:/87287/d7mh2m/publication/1765066' ) return;

    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  async _onAppStateUpdate(e) {
    if( e.location.page !== 'work' ) return;

    // TEMP hack
    this.workId = 'ark:/87287/d7mh2m/publication/1765066';
    await this.WorkModel.get(this.workId);
  }

  _onWorkUpdate(e) {
    if( e.state !== 'loaded' ) return;

    this.workId = e.id;
    this.work = e.payload;

    // update page data
    let graphRoot = this.work['@graph'].filter(item => item['@id'] === this.workId)[0];
    let publishers = this.work['@graph'].filter(item => item['@id'] !== this.workId);

    this.publicationName = graphRoot.title;
    this.abstract = graphRoot.abstract;
  }
}

customElements.define('app-work', AppWork);
