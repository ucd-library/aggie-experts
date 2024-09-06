import { LitElement} from 'lit';

import render from './category-filter-row.tpl.js';

import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../utils/app-icons.js';

/**
 * @class CategoryFilterRow
 * @description filter results on search pages
 */
export class CategoryFilterRow extends LitElement {

  static get properties() {
    return {
      label : { type : String },
      count : { type : Number },
      icon : { type : String },
      active : { type : Boolean }
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);

    this.label = '';
    this.count = 0;
    this.icon = '';
    this.active = false;
  }

}

customElements.define('category-filter-row', CategoryFilterRow);
