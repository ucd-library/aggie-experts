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

    let type = e.location.query.type || '';
    let status = e.location.query.status || '';
    this._updateActiveFilter(type, status);

    // TODO set selected filter based on filter in query.. but search results not showing correct subset
    // updates needed in the app-search component?
    // seems to be from the api not returning the correct subset of results, but can't replicate command line


    // let searchTerm = e.location.path[1] || e.location.query.q || '';
    let searchQuery = utils.buildSearchQuery(this.searchTerm);

    // TODO filter counts not working when more filters added for availability
    // we want to filter experts only, grants unaffected
    debugger;
    /*

    e.location.query : {
      hasAvailability: "media"
      q: "climate"
      type: "expert"
    }
    */

    if( searchQuery !== this.searchQuery ) {
      this.searchQuery = searchQuery;
      this._onSearchUpdate(await this.SearchModel.search(this.searchQuery));
    }
  }

  /**
   * @method _onSearchUpdate
   * @description bound to SearchModel search-update event
   *
   * @param {Object} searchResults
   */
  _onSearchUpdate(e) {
    if( e?.state !== 'loaded' ) return;
    if( e?.search !== this.searchQuery ) return;

    this.rawSearchData = JSON.parse(JSON.stringify(e.payload));
    if( !this.rawSearchData.aggregations ) {
      this.filters = [];
      return;
    }

    this._updateFilterCounts(this.rawSearchData.total, this.rawSearchData.aggregations);
  }

  _updateFilterCounts(total='', aggregations={}) {
    let allResultsFilter = this.filters.filter(f => f.type === '')?.[0];
    if( allResultsFilter ) allResultsFilter.count = total || 0;

    let expertsFilter = this.filters.filter(f => f.type === 'expert')?.[0];
    if( expertsFilter ) expertsFilter.count = aggregations.type?.expert || 0;

    let grantsFilter = this.filters.filter(f => f.type === 'grant')?.[0];
    if( grantsFilter ) {
      grantsFilter.count = aggregations.type?.grant || 0;

      let grantSubFilters = grantsFilter.subFilters || [];
      if( grantSubFilters.length ) {
        let activeGrantsFilter = grantSubFilters.filter(sf => sf.status === 'active')?.[0];
        if( activeGrantsFilter ) activeGrantsFilter.count = aggregations.status?.active || 0;

        let completedGrantsFilter = grantSubFilters.filter(sf => sf.status === 'completed')?.[0];
        if( completedGrantsFilter ) completedGrantsFilter.count = aggregations.status?.completed || 0;
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
