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
      hideSearchMatches : { type : Boolean, attribute : 'hide-search-matches' }
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);

    this.result = {};
    this.resultType = '';
    this.hideCheckbox = false;
    this.hideSearchMatches = false;
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

  /**
   * @method _filterByWorks
   * @description filter by works
   * @param {Object} e
   */
  _filterByWorks(e) {
    e.preventDefault();

    this.dispatchEvent(new CustomEvent('filter-by-works', {
      detail: {
        id: this.result.id,
        name: this.result.name
      }
    }));
  }

  /**
   * @method _selectResult
   * @description select result
   * @param {Object} e
   */
  _selectResult(e) {
    e.preventDefault();

    this.dispatchEvent(new CustomEvent('select-result', {
      detail: {
        id: this.result.id,
        name: this.result.name,
        selected: e.target.checked
      }
    }));
  }

}
customElements.define('app-search-result-row', SearchResultRow);
