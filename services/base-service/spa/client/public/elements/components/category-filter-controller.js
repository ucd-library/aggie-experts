import { LitElement} from 'lit';

import render from './category-filter-controller.tpl.js';

import './category-filter-row.js';

/**
 * @class CategoryFilterController
 * @description filters component
 */
export class CategoryFilterController extends LitElement {

  static get properties() {
    return {
      filters : { type : Array }, // { label, count, icon, active }
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);

    this.filters = [];
  }

  /**
   * @method _onFilterChange
   * @description filter click
   *
   */
  _onFilterChange(e) {
    let label = e.target.getAttribute('label');
    if( label === this.filters.filter(f => f.active)[0]?.label ) return;

    this.dispatchEvent(new CustomEvent('filter-change', {
      detail : { label }
    }));

    this.filters = this.filters.map(f => {
      f.active = f.label === label;
      return f;
    });
  }

}

customElements.define('category-filter-controller', CategoryFilterController);
