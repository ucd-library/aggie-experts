import { LitElement} from 'lit';
import render from './category-filter-controller.tpl.js';

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import './category-filter-row.js';

import utils from '../../lib/utils';

/**
 * @class CategoryFilterController
 * @description filters component
 */
export class CategoryFilterController extends Mixin(LitElement)
.with(LitCorkUtils) {

  static get properties() {
    return {
      searchTerm : { type : String },
      filters : { type : Array }, // { label, count, icon, active }
      currentPage : { type : Number },
      resultsPerPage : { type : Number },
      mobile : { type : Boolean },
      globalAggregations : { type : Object },
    };
  }

  constructor() {
    super();
    this.render = render.bind(this);

    this._injectModel('AppStateModel');

    this.searchTerm = '';
    this.searchQuery = '';
    this.currentPage = 1;
    this.resultsPerPage = 25;
    this.mobile = false;
    this.globalAggregations = {};
    this.filters = [
      {
        label : 'All Results',
        '@type' : '',
        count : 0,
        icon : 'fa-infinity',
        active : true
      },
      {
        label : 'Experts',
        '@type' : 'expert',
        count : 0,
        icon : 'fa-user',
        active : false
      },
      {
        label : 'Grants',
        '@type' : 'grant',
        count : 0,
        icon : 'fa-file-invoice-dollar',
        active : false,
        subFilters : [
          { label : 'Active', '@type' : 'grant', status : 'active', count : 0, active : false },
          { label : 'Completed', '@type' : 'grant', status : 'completed', count : 0, active : false }
        ]
      },
      {
        label: 'Works',
        '@type': 'work',
        count: 0,
        icon: 'fa-book-open',
        active: false,
        subFilters: [] // built from aggregations function below
      },
      // { label: 'Subjects', count: 0, icon: 'lightbulb-on', active: false }
    ];

  }

  async firstUpdated() {
    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  updated(changedProperties) {
    if (changedProperties.has('globalAggregations') && Object.keys(this.globalAggregations || {}).length) {
      this._updateFilterCounts();
    }
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @return {Object} e
   */
  async _onAppStateUpdate(e) {
    if( e.location.page !== 'search' ) return;

    let searchTerm = decodeURIComponent(e.location.query?.q || e.location.path?.[1] || '');
    if( !searchTerm ) return;

    this.atType = e.location.query['@type'] || '';
    this.status = e.location.query.status || '';
    this.type = e.location.query.type || '';

    this._updateActiveFilter();
  }

  _updateFilterCounts() {
    let expertsCount = this.globalAggregations['@type']?.expert || 0;
    let grantsCount = this.globalAggregations['@type']?.grant || 0;
    let worksCount = this.globalAggregations['@type']?.work || 0;
    let total = expertsCount + grantsCount + worksCount;

    let allResultsFilter = this.filters.filter(f => f['@type'] === '')?.[0];
    if( allResultsFilter ) allResultsFilter.count = total;

    let expertsFilter = this.filters.filter(f => f['@type'] === 'expert')?.[0];
    if( expertsFilter ) expertsFilter.count = expertsCount;

    // grants+subfilters
    let grantsFilter = this.filters.filter(f => f['@type'] === 'grant')?.[0];
    if( grantsFilter ) {
      grantsFilter.count = grantsCount;

      let grantSubFilters = grantsFilter.subFilters || [];
      if( grantSubFilters.length ) {
        let activeGrantsFilter = grantSubFilters.filter(sf => sf.status === 'active')?.[0];
        if( activeGrantsFilter ) activeGrantsFilter.count = this.globalAggregations.status?.active || 0;

        let completedGrantsFilter = grantSubFilters.filter(sf => sf.status === 'completed')?.[0];
        if( completedGrantsFilter ) completedGrantsFilter.count = this.globalAggregations.status?.completed || 0;
      }
    }

    // works+subfilters
    let worksFilter = this.filters.filter(f => f['@type'] === 'work')?.[0];
    if( worksFilter ) {
      worksFilter.count = worksCount;

      let workSubFilters = [];
      let types = Object.keys(this.globalAggregations.type || {});

      // sort by subfilter name asc
      types.sort((a,b) => utils.getCitationType(a).localeCompare(utils.getCitationType(b)));

      types.forEach(t => {
        workSubFilters.push({
          label : utils.getCitationType(t),
          '@type' : 'work',
          type : t,
          count : this.globalAggregations.type[t],
          active : this.type === t
        });
      });

      if( workSubFilters.length ) {
        worksFilter.subFilters = workSubFilters;
      }
    }

    this.filters = [...this.filters];
    this.requestUpdate();
  }

  /**
   * @method _onFilterChange
   * @description filter click
   *
   */
  _onFilterChange(e) {
    let atType = e.target['@type'];

    if( atType === this.filters.filter(f => f.active)[0]?.['@type'] ) return;

    this._updateActiveFilter(atType);

    this.dispatchEvent(new CustomEvent('filter-change', {
      detail : { ['@type'] : atType.toLowerCase() }
    }));
  }

  /**
   * @method _onSubFilterChange
   * @description subfilter click
   *
   */
  _onSubFilterChange(e) {
    this.atType = e.target['@type'];
    this.type = e.target.type;
    this.status = e.target.status;

    // if subfilter is already active, do nothing
    if( this.atType === 'grant' ) {
      if( this.filters.filter(f => f.active && f.status === this.status).length ) return;
    } else if( this.atType === 'work' ) {
      if( this.filters.filter(f => f.active && f.type === this.type).length ) return;
    }

    this._updateActiveFilter();

    this.dispatchEvent(new CustomEvent('subfilter-change', {
      detail : {
        '@type' : this.atType.toLowerCase(),
        type : (this.type || '').toLowerCase(),
        status : (this.status || '').toLowerCase()
      }
    }));
  }

  _updateActiveFilter() {
    this.filters = this.filters.map(f => {
      if( this.status ) {
        f.active = f['@type'] === this.atType && f.status === this.status;
      } else if( this.type ) {
        f.active = f['@type'] === this.atType && f.type === this.type;
      } else {
        f.active = f['@type'] === this.atType;
      }
      f.subFilters = (f.subFilters || []).map(sf => {
        sf.active = sf['@type'] === this.atType && (sf.status === this.status || sf.type === this.type);
        return sf;
      });

      return f;
    });
  }

}

customElements.define('category-filter-controller', CategoryFilterController);
