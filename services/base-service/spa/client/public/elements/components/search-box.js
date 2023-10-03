import { LitElement} from 'lit';

import render from './search-box.tpl.js';

import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../utils/app-icons';

/**
 * @class AppSearchBox
 * @description search box
 */
export class AppSearchBox extends LitElement {

  static get properties() {
    return {
      placeholder : { type : String },
      isGold : { type : Boolean, attribute : 'is-gold' },
      searchRounded : { type : Boolean, attribute : 'search-rounded' },
      searchTerm : { type : String, attribute : 'search-term' }
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);
    this.placeholder = '';
    this.isGold = false;
    this.searchRounded = false;
    this.searchTerm = '';
  }

  /**
   * @method browseValue
   * @description This is used in case browse functionality is added
   * @returns {String} browseValue
   */

  get value() {
    return this.$.input.value;
  }

  set value(value) {
    this.$.input.value = value;
  }


  /**
   * @method _handleChange
   * @description This handles the change when the button is clicked
   * and adds value to variable.
   *
   * @param {Object} e
   *
   */
  _handleChange(e){
    this.searchTerm = e.target.value;
  }

  /**
   * @method _fireSearch
   * @description Activates search when the button is clicked and
   * creates a custom event.
   *
   */
  _fireSearch() {
    this.dispatchEvent(
      new CustomEvent(
        'search',
        {
          detail: this.searchTerm,
          bubbles: true,
          composed: true
        }
      )
    );
  }

  /**
   * @method _fireSearch
   * @param {Object} e
   * @description The key value is activated if search is entered.
   *
   * @return {NULL}
   */
  _onKeyUp(e) {
    if( e.which !== 13 ) return;
    this._handleChange(e);
    this._fireSearch();
  }

}
customElements.define('app-search-box', AppSearchBox);
