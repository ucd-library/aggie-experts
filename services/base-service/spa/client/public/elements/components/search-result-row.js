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
      resultType : { type : String, attribute : 'result-type' },
      hideCheckbox : { type : Boolean, attribute : 'hide-checkbox' },
      hideSearchMatches : { type : Boolean, attribute : 'hide-search-matches' },
      hideWorksMatches : { type : Boolean, attribute : 'hide-works-matches' },
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);

    this.result = {};
    this.resultType = '';
    this.hideCheckbox = false;
    this.hideSearchMatches = false;
    this.hideWorksMatches = true; // bringing back search matches in next release
  }

  /**
   * @method _filterByGrants
   * @description filter by grants
   * @param {Object} e
   */
  _filterByGrants(e) {
    e.preventDefault();

    this.dispatchEvent(new CustomEvent('filter-by-grants', {
      detail: {
        id: this.result.id,
        name: this.result.name
      }
    }));
  }

}
customElements.define('app-search-result-row', SearchResultRow);
