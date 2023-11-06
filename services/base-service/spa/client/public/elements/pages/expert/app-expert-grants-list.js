import { LitElement } from 'lit';
import {render} from "./app-expert-grants-list.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";
import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";

import utils from '../../../lib/utils';

export default class AppExpertGrantsList extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      expertId : { type : String },
      expert : { type : Object },
      expertName : { type : String },
      grants : { type : Array },
      grantsActiveDisplayed : { type : Array },
      grantsCompletedDisplayed : { type : Array },
      paginationTotal : { type : Number },
      currentPage : { type : Number },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'ExpertModel');

    this.expertId = '';
    this.expert = {};
    this.expertName = '';
    this.grants = [];
    this.grantsActiveDisplayed = [];
    this.grantsCompletedDisplayed = [];
    this.paginationTotal = 1;
    this.currentPage = 1;
    this.resultsPerPage = 25;

    this.render = render.bind(this);
  }

  async firstUpdated() {
    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  willUpdate() {
    // hack, pagination links too wide
    let pagination = this.shadowRoot.querySelector('ucd-theme-pagination');
    if( !pagination ) return;

    let pageLinks = pagination.shadowRoot.querySelectorAll('.pager__item a') || [];
    pageLinks.forEach(link => {
      link.style.padding = '0.25rem';
    });
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @return {Object} e
   */
  async _onAppStateUpdate(e) {
    if( e.location.page !== 'grants' ) {
      // reset data to first page of results
      this.currentPage = 1;
      let grants = JSON.parse(JSON.stringify(this.expert['@graph'].filter(g => g['@type'].includes('Grant'))));
      this.grants = utils.parseGrants(grants);
      this.grantsActiveDisplayed = (this.grants.filter(g => !g.completed) || []).slice(0, this.resultsPerPage);
      this.grantsCompletedDisplayed = (this.grants.filter(g => g.completed) || []).slice(0, this.resultsPerPage - this.grantsActiveDisplayed.length);
      return;
    }
    window.scrollTo(0, 0);

    let expertId = e.location.pathname.replace('/grants/', '');
    if( !expertId ) this.dispatchEvent(new CustomEvent("show-404", {}));
    if( expertId === this.expertId ) return;

    try {
      let expert = await this.ExpertModel.get(expertId);
      this._onExpertUpdate(expert);
    } catch (error) {
      console.warn('expert ' + expertId + ' not found, throwing 404');

      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
    }
  }

  /**
   * @method _onExpertUpdate
   * @description bound to ExpertModel expert-update event
   *
   * @return {Object} e
   */
  async _onExpertUpdate(e) {
    if( e.state !== 'loaded' ) return;
    if( this.AppStateModel.location.page !== 'grants' ) return;
    if( e.id === this.expertId ) return;

    this.expertId = e.id;
    this.expert = JSON.parse(JSON.stringify(e.payload));

    let graphRoot = this.expert['@graph'].filter(item => item['@id'] === this.expertId)[0];
    this.expertName = graphRoot.name;

    let grants = JSON.parse(JSON.stringify(this.expert['@graph'].filter(g => g['@type'].includes('Grant'))));
    this.grants = utils.parseGrants(grants);

    this.grantsActiveDisplayed = (this.grants.filter(g => !g.completed) || []).slice(0, this.resultsPerPage);
    this.grantsCompletedDisplayed = (this.grants.filter(g => g.completed) || []).slice(0, this.resultsPerPage - this.grantsActiveDisplayed.length);

    this.paginationTotal = Math.ceil(this.grants.length / this.resultsPerPage);
  }

  /**
   * @method _onPaginationChange
   * @description bound to click events of the pagination element
   *
   * @param {Object} e click|keyup event
   */
  async _onPaginationChange(e) {
    e.detail.startIndex = e.detail.page * this.resultsPerPage - this.resultsPerPage;
    let maxIndex = e.detail.page * (e.detail.startIndex || this.resultsPerPage);
    if( maxIndex > this.grants.length ) maxIndex = this.grants.length;

    this.currentPage = e.detail.page;

    this.grantsActiveDisplayed = (this.grants.filter(g => !g.completed) || []);
    this.grantsCompletedDisplayed = (this.grants.filter(g => g.completed) || []);

    let grantsActiveCount = this.grantsActiveDisplayed.length;
    let grantsCompletedCount = this.grantsCompletedDisplayed.length;

    // if first page, load grantsActive under this.resultsPerPage and remaining from grantsCompleted
    // else if second page+, remove grants from active and completed in order
    if( this.currentPage === 1 ) {
      this.grantsActiveDisplayed = this.grantsActiveDisplayed.slice(0, this.resultsPerPage);
      this.grantsCompletedDisplayed = this.grantsCompletedDisplayed.slice(0, this.resultsPerPage - this.grantsActiveDisplayed.length);
    } else {
      let currentIndex = this.resultsPerPage * (this.currentPage - 1);
      this.grantsActiveDisplayed = this.grantsActiveDisplayed.slice(currentIndex, this.resultsPerPage);

      // TODO test..
      // what if active grants are 50?
      // what if 0 active grants and 50 completed grants?
      this.grantsCompletedDisplayed = this.grantsCompletedDisplayed.slice(currentIndex - grantsActiveCount, currentIndex - grantsActiveCount + this.resultsPerPage);
    }

    window.scrollTo(0, 0);
  }

  /**
   * @method _returnToProfile
   * @description return to /expert/<id> page
   *
   * @return {Object} e
   */
  _returnToProfile(e) {
    e.preventDefault();

    // reset data to first page of results
    this.currentPage = 1;
    let grants = JSON.parse(JSON.stringify(this.expert['@graph'].filter(g => g['@type'].includes('Grant'))));
    this.grants = utils.parseGrants(grants);
    this.grantsActiveDisplayed = (this.grants.filter(g => !g.completed) || []).slice(0, this.resultsPerPage);
    this.grantsCompletedDisplayed = (this.grants.filter(g => g.completed) || []).slice(0, this.resultsPerPage - this.grantsActiveDisplayed.length);

    this.AppStateModel.setLocation('/'+this.expertId);
  }

}

customElements.define('app-expert-grants-list', AppExpertGrantsList);
