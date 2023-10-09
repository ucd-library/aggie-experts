import { LitElement } from 'lit';
import {render} from "./app-person.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

import '@ucd-lib/theme-elements/ucdlib/ucdlib-md/ucdlib-md.js';
import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../utils/app-icons.js';

import { generateCitations } from '../utils/citation.js';

export default class AppPerson extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      personId : { type : String },
      person : { type : Object },
      personName : { type : String },
      introduction : { type : String },
      showMoreAboutMeLink : { type : Boolean },
      roles : { type : Array },
      orcId : { type : String },
      scopusId : { type : String },
      websites : { type : Array },
      citations : { type : Array },
      citationsDisplayed : { type : Array },
      canEdit : { type : Boolean }
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'PersonModel');

    this.personId = '';
    this._reset();

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
    if( e.location.page !== 'person' ) return;
    window.scrollTo(0, 0);

    let personId = e.location.pathname.substr(1);
    if( personId === this.personId ) return;

    this._reset();

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
    console.log('person payload', this.person);

    // update page data
    let graphRoot = this.person['@graph'].filter(item => item['@id'] === this.personId)[0];

    console.log('person graphRoot', graphRoot);
    this.personName = graphRoot.name;

    // max 500 characters, unless 'show me more' is clicked
    this.introduction = graphRoot.overview;
    this.showMoreAboutMeLink = this?.introduction?.length > 500;

    this.roles = graphRoot.contactInfo?.filter(c => c['ucdlib:isPreferred'] === true).map(c => {
      return {
        title : c.hasTitle?.name,
        department : c.hasOrganizationalUnit?.name,
        email : c?.hasEmail?.replace('email:', ''),
        websiteUrl : c.hasURL?.['url']
      }
    });

    this.orcId = graphRoot.orcidId;
    this.scopusId = graphRoot.scopusId;

    let websites = graphRoot.contactInfo?.filter(c => (!c['ucdlib:isPreferred'] || c['ucdlib:isPreferred'] === false) && c['vivo:rank'] === 20 && c.hasURL);
    websites.forEach(w => {
      if( !Array.isArray(w.hasURL) ) w.hasURL = [w.hasURL];
      this.websites.push(...w.hasURL);
    });

    await this._loadCitations();
  }

  /**
   * @method _reset
   * @description clear all page data, called on connected and when personId changes
   */
  _reset() {
    this.person = {};
    this.personName = '';
    this.introduction = '';
    this.showMoreAboutMeLink = false;
    this.roles = [];
    this.orcId = '';
    this.scopusId = '';
    this.websites = [];
    this.citations = [];
    this.citationsDisplayed = [];
    this.canEdit = true;
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
      let newIssueDate = cite.issued?.['date-parts']?.[0]
      if( i > 0 && ( newIssueDate === this.citations[i-1].issued?.['date-parts']?.[0] || lastPrintedYear === newIssueDate ) ) {
        delete cite.issued;
        lastPrintedYear = newIssueDate;
      }
    });
    console.log('this.citations', this.citations);
    this.citationsDisplayed = this.citations.slice(0, 10);

    this.requestUpdate();
  }


/**
   * @method _downloadWorks
   * @description bound to click events of download button in works list
   *
   * @param {Object} e click|keyup event
   */
_downloadWorks(e) {
  e.preventDefault();

  let text = this.citations.map(c => c.ris).join('\n');
  let blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
  let url = URL.createObjectURL(blob);
  console.log('url', url)

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'data.txt');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
  // _downloadRIS(e) {
  //   e.preventDefault();

  //   let text = this.citations.map(c => c.ris).join('\n');
  //   let blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
  //   let url = URL.createObjectURL(blob);
  //   console.log('url', url)

  //   const link = document.createElement('a');
  //   link.setAttribute('href', url);
  //   link.setAttribute('download', 'data.txt');
  //   link.style.display = 'none';
  //   document.body.appendChild(link);
  //   link.click();
  //   document.body.removeChild(link);
  // }

  /**
   * @method _seeAllWorks
   * @description load page to list all works
   */
  _seeAllWorks(e) {
    e.preventDefault();

    this.AppStateModel.setLocation('/works/'+this.personId);
  }

  _editName(e) {}
  _editRoles(e) {}
  _editWebsites(e) {}

  /**
   * @method _editWorks
   * @description load page to list all works in edit mode
   */
  _editWorks(e) {
    e.preventDefault();

    this.AppStateModel.setLocation('/works-edit/'+this.personId);
  }


}

customElements.define('app-person', AppPerson);
