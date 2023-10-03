import { LitElement } from 'lit';
import {render} from "./app-person-works.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

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

    this.render = render.bind(this);
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
    if( e.location.page !== 'works' ) return;
    window.scrollTo(0, 0);

    let personId = e.location.pathname.replace('/works/', '');
    if( personId === this.personId ) return;

    this._onPersonUpdate(await this.PersonModel.get(personId));
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
        citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]))
      } catch (error) {
        let invalidCitations = citations.filter(c => typeof c.issued !== 'string');
        if( invalidCitations.length ) console.warn('Invalid citation issue date, should be a string value', invalidCitations);

        citations = citations.filter(c => typeof c.issued === 'string');
      }

      citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]))
      let citationResults = await generateCitations(citations);

      this.citations = citationResults.map(c => c.value);

      // also remove issued date from citations if not first displayed on page from that year
      let lastPrintedYear;
      this.citations.forEach((cite, i) => {
        let newIssueDate = cite.issued?.['date-parts']?.[0];
        if( i > 0 && ( newIssueDate === this.citations[i-1].issued?.['date-parts']?.[0] || lastPrintedYear === newIssueDate ) ) {
          delete cite.issued;
          lastPrintedYear = newIssueDate;
        }
      });
      this.citationsDisplayed = this.citations.slice(0, 20);

      this.requestUpdate();
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
