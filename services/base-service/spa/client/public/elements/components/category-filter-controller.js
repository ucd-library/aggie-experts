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
    let type = e.target.getAttribute('type');
    if( type === this.filters.filter(f => f.active)[0]?.type ) return;

    this.filters = this.filters.map(f => {
      f.active = f.type === type;
      f.subFilters = (f.subFilters || []).map(sf => {
        sf.active = false;
        return sf;
      });

      return f;
    });

    this.dispatchEvent(new CustomEvent('filter-change', {
      detail : { type : type.toLowerCase() }
    }));
  }

  /**
   * @method _onSubFilterChange
   * @description subfilter click
   *
   */
  _onSubFilterChange(e) {
    let type = e.target.getAttribute('type');
    let parentType = e.target.getAttribute('parent-type');

    if( type === this.filters.filter(f => f.active)[0]?.type ) return;

    this.filters = this.filters.map(f => {
      f.active = f.type === type;
      f.subFilters = (f.subFilters || []).map(sf => {
        sf.active = sf.type === type;
        return sf;
      });

      return f;
    });

    this.dispatchEvent(new CustomEvent('subfilter-change', {
      detail : {
        type : type.toLowerCase(),
        parentType : parentType.toLowerCase()
      }
    }));
  }

}

customElements.define('category-filter-controller', CategoryFilterController);
