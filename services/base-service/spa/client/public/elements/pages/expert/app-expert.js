import { LitElement } from 'lit';
import {render} from "./app-expert.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

import '@ucd-lib/theme-elements/ucdlib/ucdlib-md/ucdlib-md.js';
import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../../utils/app-icons.js';
import '../../components/modal-overlay.js';

import { generateCitations } from '../../utils/citation.js';
import utils from '../../../lib/utils';

export default class AppExpert extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      expertId : { type : String },
      expert : { type : Object },
      expertName : { type : String },
      introduction : { type : String },
      researchInterests : { type : String },
      showMoreAboutMeLink : { type : Boolean },
      roles : { type : Array },
      orcId : { type : String },
      scopusIds : { type : Array },
      researcherId : { type : String },
      websites : { type : Array },
      citations : { type : Array },
      citationsDisplayed : { type : Array },
      grants : { type : Array },
      grantsActiveDisplayed : { type : Array },
      grantsCompletedDisplayed : { type : Array },
      canEdit : { type : Boolean },
      modalTitle : { type : String },
      modalContent : { type : String },
      showModal : { type : Boolean },
      grantsPerPage : { type : Number },
      worksPerPage : { type : Number },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'ExpertModel');

    this.expertId = '';
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
    if( e.location.page !== 'expert' ) return;
    window.scrollTo(0, 0);

    let expertId = e.location.pathname.substr(1);
    if( expertId === this.expertId ) return;

    this._reset();

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
    if( this.AppStateModel.location.page !== 'expert' ) return;
    if( e.id === this.expertId ) return;

    this.expertId = e.id;
    this.expert = JSON.parse(JSON.stringify(e.payload));
    this.canEdit = APP_CONFIG.user.expertId === this.expertId;

    // update page data
    let graphRoot = (this.expert['@graph'] || []).filter(item => item['@id'] === this.expertId)[0];

    this.expertName = Array.isArray(graphRoot.name) ? graphRoot.name[0] : graphRoot.name;

    // max 500 characters, unless 'show me more' is clicked
    this.introduction = graphRoot.overview;
    this.showMoreAboutMeLink = this?.introduction?.length > 500;

    this.researchInterests = graphRoot.researchInterests;

    this.roles = graphRoot.contactInfo?.filter(c => c['isPreferred'] === true).map(c => {
      return {
        title : c.hasTitle?.name,
        department : c.hasOrganizationalUnit?.name,
        email : c?.hasEmail?.replace('email:', ''),
        websiteUrl : c.hasURL?.['url']
      }
    });

    this.orcId = graphRoot.orcidId;
    this.scopusIds = Array.isArray(graphRoot.scopusId) ? graphRoot.scopusId : [graphRoot.scopusId];
    this.researcherId = graphRoot.researcherId;

    let websites = graphRoot.contactInfo?.filter(c => (!c['isPreferred'] || c['isPreferred'] === false) && c['vivo:rank'] === 20 && c.hasURL);
    websites.forEach(w => {
      if( !Array.isArray(w.hasURL) ) w.hasURL = [w.hasURL];
      this.websites.push(...w.hasURL);
    });

    await this._loadCitations();

    let grants = JSON.parse(JSON.stringify((this.expert['@graph'] || []).filter(g => g['@type'].includes('Grant'))));
    this.grants = utils.parseGrants(grants);

    this.grantsActiveDisplayed = (this.grants.filter(g => !g.completed) || []).slice(0, this.grantsPerPage);
    this.grantsCompletedDisplayed = (this.grants.filter(g => g.completed) || []).slice(0, this.grantsPerPage - this.grantsActiveDisplayed.length);

    // throw errors if any citations/grants have is-visible:false
    let invalidCitations = this.citations.filter(c => !c['is-visible']);
    let invalidGrants = this.grants.filter(g => !g.relatedBy?.['is-visible']);

    if( invalidCitations.length ) console.warn('Invalid citation is-visible, should be true', invalidCitations);
    if( invalidGrants.length ) console.warn('Invalid grant is-visible, should be true', invalidGrants);
  }

  /**
   * @method _reset
   * @description clear all page data, called on connected and when expertId changes
   */
  _reset() {
    this.expert = {};
    this.expertName = '';
    this.introduction = '';
    this.showMoreAboutMeLink = false;
    this.roles = [];
    this.orcId = '';
    this.scopusIds = [];
    this.researcherId = '';
    this.websites = [];
    this.citations = [];
    this.citationsDisplayed = [];
    this.grants = [];
    this.grantsActiveDisplayed = [];
    this.grantsCompletedDisplayed = [];
    this.canEdit = APP_CONFIG.user?.expertId === this.expertId;
    this.modalTitle = '';
    this.modalContent = '';
    this.showModal = false;
    this.resultsPerPage = 25;
    this.grantsPerPage = 5;
    this.worksPerPage = 10;
  }

  /**
   * @method toggleAdminUi
   * @description toggle admin ui based on user expertId
   *
  */
  toggleAdminUi() {
    debugger;
    this.canEdit = APP_CONFIG.user?.expertId === this.expertId;
  }

  /**
   * @method _loadCitations
   * @description load citations for expert async
   *
   * @param {Boolean} all load all citations, not just first 25, used for downloading all citations
   */
  async _loadCitations(all=false) {
    let citations = JSON.parse(JSON.stringify((this.expert['@graph'] || []).filter(g => g.issued)));

    try {
      // sort by issued date desc, then by title asc
      citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]) || a.title.localeCompare(b.title))
    } catch (error) {
      let invalidCitations = citations.filter(c => typeof c.issued !== 'string');
      if( invalidCitations.length ) console.warn('Invalid citation issue date, should be a string value', invalidCitations);
      if( citations.filter(c => typeof c.title !== 'string').length ) console.warn('Invalid citation title, should be a string value');
      citations = citations.filter(c => typeof c.issued === 'string' && typeof c.title === 'string');
    }

    this.citations = citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]) || a.title.localeCompare(b.title))
    let citationResults = all ? await generateCitations(this.citations) : await generateCitations(this.citations.slice(0, this.worksPerPage));

    this.citationsDisplayed = citationResults.map(c => c.value);

    // also remove issued date from citations if not first displayed on page from that year
    let lastPrintedYear;
    this.citationsDisplayed.forEach((cite, i) => {
      let newIssueDate = cite.issued?.[0];
      if( i > 0 && ( newIssueDate === this.citationsDisplayed[i-1].issued?.[0] || lastPrintedYear === newIssueDate ) ) {
        delete cite.issued;
        lastPrintedYear = newIssueDate;
      }
    });

    // update doi links to be anchor tags
    this.citationsDisplayed.forEach(cite => {
      if( cite.DOI && cite.apa ) {
        // https://doi.org/10.3389/fvets.2023.1132810</div>\n</div>
        cite.apa = cite.apa.split(`https://doi.org/${cite.DOI}`)[0]
                  + `<a href="https://doi.org/${cite.DOI}">https://doi.org/${cite.DOI}</a>`
                  + cite.apa.split(`https://doi.org/${cite.DOI}`)[1];
      }
    });

    this.requestUpdate();
  }

  /**
   * @method _downloadWorks
   * @description bound to click events of download button in works list. download .ris file of all works
   *
   * @param {Object} e click|keyup event
   */
  async _downloadWorks(e) {
    e.preventDefault();
    await this._loadCitations(true);

    let text = this.citationsDisplayed.map(c => c.ris).join('\n');
    let blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    let url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'works.ris');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * @method _downloadGrants
   * @description bound to click events of download button in grants list. download csv file of all grants
   *
   * @param {Object} e click|keyup event
   */
  async _downloadGrants(e) {
    e.preventDefault();

    let body = [];
    this.grants.forEach(grant => {
      body.push([
        '"' + (grant.name || '') + '"',                               // Title
        '"' + (grant.awardedBy || '') + '"',                          // Funding Agency
        '"' + (grant.sponsorAwardId || '') + '"',                     // Grant id {the one given by the agency, not ours}
        '"' + (grant.dateTimeInterval?.start?.dateTime || '') + '"',  // Start date
        '"' + (grant.dateTimeInterval?.end?.dateTime || '') + '"',    // End date
        '"' + (grant.role || '') + '"',                               // Type of Grant
        '?', // List of contributors (role) {separate contributors by ";"}
      ]);
    });

    /*
    {
      "assignedBy": {
          "@type": "FundingOrganization",
          "name": "UC LAWRENCE BERKELEY LABORATORY",
          "@id": "ark:/87287/d7mh2m/grant/4326881#unknown-funder"
      },
      "dateTimeInterval": {
          "@type": "DateTimeInterval",
          "start": {
              "dateTime": "2009-09-21",
              "@type": "DateTimeValue",
              "@id": "ark:/87287/d7mh2m/grant/4326881#start-date",
              "dateTimePrecision": "vivo:yearMonthDayPrecision"
          },
          "end": {
              "dateTime": "2011-09-30",
              "@type": "DateTimeValue",
              "@id": "ark:/87287/d7mh2m/grant/4326881#end-date",
              "dateTimePrecision": "vivo:yearMonthDayPrecision"
          },
          "@id": "ark:/87287/d7mh2m/grant/4326881#duration"
      },
      "@type": [
          "Grant",
          "vivo:Grant"
      ],
      "totalAwardAmount": "3062730",
      "name": "GENOMIC ENCICLOPEDIA OF BACTERIA AND ARCHAEE",
      "@id": "ark:/87287/d7mh2m/grant/4326881",
      "relatedBy": {
          "relates": [
              "expert/226d2dccfba4c2be04aedd4f9f942e42",
              "ark:/87287/d7mh2m/grant/4326881"
          ],
          "@type": "GrantRole",
          "@id": "ark:/87287/d7mh2m/relationship/13238110",
          "is-visible": true
      },
      "sponsorAwardId": "6895809",
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": {
          "name": "Research",
          "@id": "ucdlib:Grant_Research"
      },
      "start": 2009,
      "end": 2011,
      "completed": true,
      "role": "Research",
      "awardedBy": "UC LAWRENCE BERKELEY LABORATORY"
    }
    */


    if( !body.length ) return;

    let headers = ['Title', 'Funding Agency', 'Grant Id', 'Start Date', 'End Date', 'Type of Grant', 'List of Contributors'];
    let text = headers.join(',') + '\n';
    body.forEach(row => {
      text += row.join(',') + '\n';
    });

    let blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'grants.csv');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * @method _seeAllGrants
   * @description load page to list all grants
   */
  _seeAllGrants(e) {
    e.preventDefault();

    this.AppStateModel.setLocation('/grants/'+this.expertId);
  }

  /**
   * @method _seeAllWorks
   * @description load page to list all works
   */
  _seeAllWorks(e) {
    e.preventDefault();

    this.AppStateModel.setLocation('/works/'+this.expertId);
  }

  /**
   * @method _editWebsites
   * @description show modal with link to edit websites
   */
  _editWebsites(e) {
    this.modalTitle = 'Edit Links';
    this.modalContent = `<p>Links are managed via your <strong>UC Publication Management System</strong> profile's "Web addresses and social media" section.</p><p>You will be redirected to this system.</p>`;
    this.showModal = true;
  }

  /**
   * @method _editGrants
   * @description load page to list all grants in edit mode
   */
  _editGrants(e) {
    e.preventDefault();

    this.AppStateModel.setLocation('/grants-edit/'+this.expertId);
  }

  /**
   * @method _editWorks
   * @description load page to list all works in edit mode
   */
  _editWorks(e) {
    e.preventDefault();

    this.AppStateModel.setLocation('/works-edit/'+this.expertId);
  }

}

customElements.define('app-expert', AppExpert);
