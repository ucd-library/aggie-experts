import { LitElement } from 'lit';
import {render, styles} from "./ucdlib-browse-az.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

export default class UcdlibBrowseAZ extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
        url : { type : String },
        keySort : { type : String },
        selectedLetter : { type : String, attribute : 'selected-letter' },
        noResult : { type : String, attribute : 'no-result' },
        sort : { state : true },
        urlParams : { state : true },
        alpha : { type : Array },
    }
  }

  static get styles() {
    return styles();
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'BrowseByModel');
    this.render = render.bind(this);

    this.alpha = [
        {display: 'A', value: 'a', exists: true},
        {display: 'B', value: 'b', exists: true},
        {display: 'C', value: 'c', exists: true},
        {display: 'D', value: 'd', exists: true},
        {display: 'E', value: 'e', exists: true},
        {display: 'F', value: 'f', exists: true},
        {display: 'G', value: 'g', exists: true},
        {display: 'H', value: 'h', exists: true},
        {display: 'I', value: 'i', exists: true},
        {display: 'J', value: 'j', exists: true},
        {display: 'K', value: 'k', exists: true},
        {display: 'L', value: 'l', exists: true},
        {display: 'M', value: 'm', exists: true},
        {display: 'N', value: 'n', exists: true},
        {display: 'O', value: 'o', exists: true},
        {display: 'P', value: 'p', exists: true},
        {display: 'Q', value: 'q', exists: true},
        {display: 'R', value: 'r', exists: true},
        {display: 'S', value: 's', exists: true},
        {display: 'T', value: 't', exists: true},
        {display: 'U', value: 'u', exists: true},
        {display: 'V', value: 'v', exists: true},
        {display: 'W', value: 'w', exists: true},
        {display: 'X', value: 'x', exists: true},
        {display: 'Y', value: 'y', exists: true},
        {display: 'Z', value: 'z', exists: true}
    ];

    this.selectedLetter = 'a';
    this.sort = this.defaultSort;

    this.parseLocation();
  }

  async firstUpdated() {
    await this._onAppStateUpdate(await this.AppStateModel.get());
  }

  async _onAppStateUpdate(e) {
    if( e.location.page !== 'browse' ) return;
    if( e.location.path.length < 2 ) {
      this.selectedLetter = 'a';
    } else {
      this.selectedLetter = e.location.path[2]?.toLowerCase();
    }

    // to get active filters/a-z
    await this.BrowseByModel.browseExpertsAZ();

    this.requestUpdate();
  }

  _onBrowseExpertsAzUpdate(e) {
    if( e.state !== 'loaded' ) return;

    let az = e.payload || [];
    az.forEach(item => {
      // disable if no results for letter
      let matchedLetter = this.alpha.find(l => l.value.toUpperCase() === item.params?.p.toUpperCase());
      if( matchedLetter ) matchedLetter.exists = item.total > 0;
    });
    this.requestUpdate();
  }

  parseLocation() {
    let selectedLetter = this.AppStateModel.location.pathname.split('/browse/expert/')?.[1];
    if( !selectedLetter ) return;

    this.onAlphaInput({ value : selectedLetter });
  }

  onAlphaInput(v) {
    if( !v || v.value === this.selectedLetter || !v.exists ) return;

    this.selectedLetter = v.value;
    this.AppStateModel.setLocation(`/browse/expert/${this.selectedLetter}`);
  }

}

customElements.define('ucdlib-browse-az', UcdlibBrowseAZ);
