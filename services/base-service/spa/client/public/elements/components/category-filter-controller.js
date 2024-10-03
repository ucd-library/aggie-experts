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

    this.filters = this.filters.map(f => {
      f.active = f.label === label;
      f.subFilters = (f.subFilters || []).map(sf => {
        sf.active = false;
        return sf;
      });

      return f;
    });

    this.dispatchEvent(new CustomEvent('filter-change', {
      detail : { label : label.toLowerCase() }
    }));
  }

  /**
   * @method _onSubFilterChange
   * @description subfilter click
   *
   */
  _onSubFilterChange(e) {
    let label = e.target.getAttribute('label');
    let parentLabel = e.target.getAttribute('parent-label');

    if( label === this.filters.filter(f => f.active)[0]?.label ) return;

    this.filters = this.filters.map(f => {
      f.active = f.label === label;
      f.subFilters = (f.subFilters || []).map(sf => {
        sf.active = sf.label === label;
        return sf;
      });

      return f;
    });

    this.dispatchEvent(new CustomEvent('subfilter-change', {
      detail : {
        label : label.toLowerCase(),
        parentLabel : parentLabel.toLowerCase()
      }
    }));
  }

}

customElements.define('category-filter-controller', CategoryFilterController);
