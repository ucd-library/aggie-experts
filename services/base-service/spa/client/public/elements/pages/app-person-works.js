import { LitElement } from 'lit';
import {render} from "./app-person-works.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";
import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";

import { generateCitations } from '../utils/citation.js';

export default class AppPersonWorks extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      personId : { type : String },
      person : { type : Object },
      personName : { type : String },
      citations : { type : Array },
      citationsDisplayed : { type : Array },
      paginationTotal : { type : Number },
      currentPage : { type : Number },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'PersonModel');

    this.personId = '';
    this.person = {};
    this.personName = '';
    this.citations = [];
    this.citationsDisplayed = [];
    this.paginationTotal = 1;
    this.currentPage = 1;
    this.resultsPerPage = 20;

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
    if( e.location.page !== 'works' ) return;
    window.scrollTo(0, 0);

    let personId = e.location.pathname.replace('/works/', '');
    if( personId === this.personId ) return;

    try {
      let person = await this.PersonModel.get(personId);
      this._onPersonUpdate(person);
    } catch (error) {
      console.warn('person ' + personId + ' not found, throwing 404');

      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
    }
  }

  /**
   * @method _onPersonUpdate
   * @description bound to PersonModel person-update event
   *
   * @return {Object} e
   */
  async _onPersonUpdate(e) {
    if( e.state !== 'loaded' ) return;
    if( e.id === this.personId ) return;

    this.personId = e.id;
    this.person = e.payload;

    let graphRoot = this.person['@graph'].filter(item => item['@id'] === this.personId)[0];
    this.personName = graphRoot.name;

    await this._loadCitations();
  }

  /**
   * @method _loadCitations
   * @description load citations for person async
   */
  async _loadCitations() {
    let citations = this.person['@graph'].filter(g => g.issued);

    try {
      // sort by issued date desc, then by title asc
      citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]) || a.title.localeCompare(b.title))
    } catch (error) {
      let invalidCitations = citations.filter(c => typeof c.issued !== 'string');
      if( invalidCitations.length ) console.warn('Invalid citation issue date, should be a string value', invalidCitations);
      if( citations.filter(c => typeof c.title !== 'string').length ) console.warn('Invalid citation title, should be a string value');

      citations = citations.filter(c => typeof c.issued === 'string' && typeof c.title === 'string');
    }

    citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]) || a.title.localeCompare(b.title))
    let citationResults = await generateCitations(citations);

    this.citations = citationResults.map(c => c.value);

    // also remove issued date from citations if not first displayed on page from that year
    let lastPrintedYear;
    this.citations.forEach((cite, i) => {
      let newIssueDate = cite.issued?.['date-parts']?.[0];
      if( i > 0 && ( newIssueDate === this.citations[i-1].issued?.['date-parts']?.[0] || lastPrintedYear === newIssueDate ) && i % 20 !== 0 ) {
        delete cite.issued;
        lastPrintedYear = newIssueDate;
      }
    });
    this.citationsDisplayed = this.citations.slice(0, 20);
    this.paginationTotal = Math.ceil(this.citations.length / this.resultsPerPage);

    this.requestUpdate();
  }

  /**
   * @method _onPaginationChange
   * @description bound to click events of the pagination element
   *
   * @param {Object} e click|keyup event
   */
  _onPaginationChange(e) {
    e.detail.startIndex = e.detail.page * this.resultsPerPage - this.resultsPerPage;
    let maxIndex = e.detail.page * (e.detail.startIndex || this.resultsPerPage);
    if( maxIndex > this.citations.length ) maxIndex = this.citations.length;

    this.citationsDisplayed = this.citations.slice(e.detail.startIndex, maxIndex);
    this.currentPage = e.detail.page;
    window.scrollTo(0, 0);
  }


  /**
   * @method _returnToProfile
   * @description return to /person/<id> page
   *
   * @return {Object} e
   */
  _returnToProfile(e) {
    e.preventDefault();
    this.AppStateModel.setLocation('/'+this.personId);
  }

}

customElements.define('app-person-works', AppPersonWorks);
