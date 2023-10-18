import { LitElement } from 'lit';
import {render, styles} from "./ucdlib-browse-az.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

export default class UcdlibBrowseAZ extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
        url: {type: String},
        keySort: {type: String},
        selectedLetter: {type: String, attribute: 'selected-letter'},
        noResult: {type: String, attribute: 'no-result'},
        sort: {state: true},
        urlParams: {state: true}
    }
  }

  static get styles() {
    return styles();
  }

  constructor() {
    super();
    this._injectModel('AppStateModel');
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
    this.keySort = 'collection-az';
    this.defaultSort = 'a';
    this.sort = this.defaultSort;

    this.parseLocation();

  }

  willUpdate(props){
    if ( props.has('noResult') )
    this.checksExist();
  }

  checksExist() {
    let emptyArray = this.noResult.split(",");
    for( let x of emptyArray ) {
      const a = this.alpha.find(o => o.value === x);
      if( a ) {
        a["exists"] = false;
      }
    }
  }

  parseLocation() {
    debugger;
    this.url = window.location.origin + window.location.pathname;
    this.urlParams = new URLSearchParams(window.location.search);
    this.sort = this.urlParams.get(this.keySort) || this.defaultSort;
  }

  onAlphaInput(v) {
    if( !v.exists || v.value == this.selectedLetter ) return;
    v = v.value;
    this.sort = v;
    this.updateUrlParams(this.defaultSort, this.keySort, v);
    this.urlParams.set('collection-tax', 'az');
    this.updateLocation();
  }

  updateLocation() {
    return; // TODO once api is ready
    let queryString = this.urlParams.toString();
    if( queryString ) {
      this.AppStateModel.setLocation(this.url + '?' + this.urlParams.toString());
      // window.location = this.url + '?' + this.urlParams.toString();
    } else {
      this.AppStateModel.setLocation(this.url);
      // window.location = this.url;
    }
  }

  updateUrlParams(defaultValue, key, value) {
    if( value != defaultValue ) {
      this.urlParams.set(key, value);
    } else if( value == defaultValue && this.urlParams.get(key) ) {
      this.urlParams.delete(key);
    }
  }

}

customElements.define('ucdlib-browse-az', UcdlibBrowseAZ);
