import { LitElement} from 'lit';

import render from './search-result-row.tpl.js';

import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../utils/app-icons.js';

/**
 * @class SearchResultRow
 * @description search result
 */
export class SearchResultRow extends LitElement {

  static get properties() {
    return {
      result : { type : Object },
      hideCheckbox : { type : Boolean, attribute : 'hide-checkbox' },
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);

    this.result = {};
    this.hideCheckbox = false;
  }

  firstUpdated() {
    console.log('search-result-row.result', this.result);
  }


}
customElements.define('app-search-result-row', SearchResultRow);
