import { LitElement} from 'lit';
import render from "./app-browse.tpl.js";

import {Mixin, MainDomElement} from '@ucd-lib/theme-elements/utils/mixins';
import { LitCorkUtils } from '@ucd-lib/cork-app-utils';

import './app-browse-by';

class AppBrowse extends Mixin(LitElement)
  .with(MainDomElement, LitCorkUtils) {

  static get properties() {
    return {
      browseType : {type: String},
      letter : {type: String},
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);
    this.active = true;

    this.browseType = '';
    this.letter = '';

    this._injectModel('AppStateModel');
  }

  async firstUpdated() {
    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  _onAppStateUpdate(e) {
    if( e.location.page !== 'browse' ) return;

    this.browseType = e.location.path[1];
    this.letter = e.location.path[2];
  }

}

customElements.define('app-browse', AppBrowse);
