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
    };
  }



  constructor() {
    super();
    this.render = render.bind(this);

    this._injectModel('AppStateModel', 'SearchModel');

    this.searchTerm = '';
    this.searchQuery = '';
    this.filters = [
      {
        label : 'All Results',
        type : '',
        count : 0,
        icon : 'fa-infinity',
        active : true
      },
      {
        label : 'Experts',
        type : 'expert',
        count : 0,
        icon : 'fa-user',
        active : false
      },
      {
        label : 'Grants',
        type : 'grant',
        count : 0,
        icon : 'fa-file-invoice-dollar',
        active : false,
        subFilters : [
          { label : 'Active', type : 'grant', status : 'active', count : 0, active : false },
          { label : 'Completed', type : 'grant', status : 'completed', count : 0, active : false }
        ]
      },
      // { label: 'Works', count: 0, icon: 'fa-book-open', active: false },
      // { label: 'Subjects', count: 0, icon: 'lightbulb-on', active: false }
    ];

  }

  async firstUpdated() {
    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @return {Object} e
   */
  async _onAppStateUpdate(e) {
    if( e.location.page !== 'search' ) return;

    this.type = e.location.query.type || '';
    this.status = e.location.query.status || '';
    this._updateActiveFilter(this.type, this.status);

    // TODO need to handle filter/query changes outside of filter controller, to call this._onSearchUpdate(await ...)
  }

  /**
   * @method _onSearchUpdate
   * @description bound to SearchModel search-update event
   *
   * @param {Object} searchResults
   */
  _onSearchUpdate(e) {
    if( e?.state !== 'loaded' ) return;

    this.rawSearchData = JSON.parse(JSON.stringify(e.payload));
    if( !this.rawSearchData.aggregations || !this.rawSearchData['global_aggregations'] ) {
      // aggregations has current count of experts when open-to is applied,
      // globalAggregations has count of grants and experts to use when no type is applied
      // this might change as the elastic search template is updated
      this.filters = [];
      return;
    }

    this._updateFilterCounts(this.rawSearchData.total, this.rawSearchData.aggregations, this.rawSearchData['global_aggregations']);
  }

  _updateFilterCounts(total='', aggregations={}, globalAggregations={}) {
    let expertsCount = 0, grantsCount = 0;

    console.log({ total, aggregations, globalAggregations });

    if( !this.type ) {
      expertsCount = aggregations.type?.expert || 0;
      grantsCount = aggregations.type?.grant || 0;
    } else if( this.type === 'expert' ) {
      expertsCount = aggregations.type?.expert || 0;
      grantsCount = globalAggregations.type?.grant || 0;
      total += grantsCount;


    // TODO need to handle subfilters here, for grants if subfilter is clicked,
    // then the grantsTotal updates show the total for that subfilter

    } else if( this.type === 'grant' ) {
      grantsCount = aggregations.type?.grant || 0;
      expertsCount = globalAggregations.type?.expert || 0;
      total += expertsCount;
    }
    // TODO does the above counts work when we have no type, like All Results?

    let allResultsFilter = this.filters.filter(f => f.type === '')?.[0];
    if( allResultsFilter ) allResultsFilter.count = total;

    let expertsFilter = this.filters.filter(f => f.type === 'expert')?.[0];
    if( expertsFilter ) expertsFilter.count = expertsCount;

    let grantsFilter = this.filters.filter(f => f.type === 'grant')?.[0];
    if( grantsFilter ) {
      grantsFilter.count = grantsCount;

      let grantSubFilters = grantsFilter.subFilters || [];
      if( grantSubFilters.length ) {
        let activeGrantsFilter = grantSubFilters.filter(sf => sf.status === 'active')?.[0];
        if( activeGrantsFilter ) activeGrantsFilter.count = globalAggregations.status?.active || 0;

        let completedGrantsFilter = grantSubFilters.filter(sf => sf.status === 'completed')?.[0];
        if( completedGrantsFilter ) completedGrantsFilter.count = globalAggregations.status?.completed || 0;
      }
    }


    this.requestUpdate();
  }


  /**
   * @method _onFilterChange
   * @description filter click
   *
   */
  _onFilterChange(e) {
    let type = e.target.getAttribute('type');

    if( type === this.filters.filter(f => f.active)[0]?.type ) return;

    this._updateActiveFilter(type);

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
    let status = e.target.getAttribute('status');

    if( this.filters.filter(f => f.active && f.status === status).length ) return;

    this._updateActiveFilter(type, status);

    this.dispatchEvent(new CustomEvent('subfilter-change', {
      detail : {
        type : type.toLowerCase(),
        status : status.toLowerCase()
      }
    }));
  }

  _updateActiveFilter(type='', status='') {
    this.filters = this.filters.map(f => {
      f.active = f.type === type && (!status || f.status === status);
      f.subFilters = (f.subFilters || []).map(sf => {
        sf.active = sf.type === type && sf.status === status;
        return sf;
      });

      return f;
    });
  }

}

customElements.define('category-filter-controller', CategoryFilterController);
