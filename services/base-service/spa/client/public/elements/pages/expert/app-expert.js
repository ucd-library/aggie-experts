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
      truncateIntroduction : { type : Boolean },
      truncateResearchInterests : { type : Boolean },
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
      totalGrants : { type : Number },
      totalCitations : { type : Number },
      canEdit : { type : Boolean },
      modalTitle : { type : String },
      modalContent : { type : String },
      showModal : { type : Boolean },
      hideCancel : { type : Boolean },
      hideSave : { type : Boolean },
      hideOK : { type : Boolean },
      grantsPerPage : { type : Number },
      worksPerPage : { type : Number },
      expertImpersonating : { type : String },
      hideImpersonate : { type : Boolean },
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

    if( this.expertImpersonating === this.expertId ) this.canEdit = true;

    try {
      let expert = await this.ExpertModel.get(expertId, true);
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
    this.introduction = graphRoot.overview || '';
    this.researchInterests = graphRoot.researchInterests || '';

    this.showMoreAboutMeLink = this.introduction.length + this.researchInterests.length > 500;
    this.truncateIntroduction = this.introduction.length > 500;
    this.truncateResearchInterests = this.introduction.length + this.researchInterests.length > 500;

    this.roles = graphRoot.contactInfo?.filter(c => c['isPreferred'] === true).map(c => {
      return {
        title : c.hasTitle?.name,
        department : c.hasOrganizationalUnit?.name,
        email : c?.hasEmail?.replace('mailto:', ''),
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
    this.totalGrants = grants.length;

    // throw errors if any citations/grants have is-visible:false
    let invalidCitations = this.citations.filter(c => !c['is-visible']);
    let invalidGrants = this.grants.filter(g => !g.relatedBy?.['is-visible']);

    if( invalidCitations.length ) console.warn('Invalid citation is-visible, should be true', invalidCitations);
    if( invalidGrants.length ) console.warn('Invalid grant is-visible, should be true', invalidGrants);

    grants = grants.filter(g => g.relatedBy?.['is-visible']);
    this.grants = utils.parseGrants(grants);

    this.grantsActiveDisplayed = (this.grants.filter(g => !g.completed) || []).slice(0, this.grantsPerPage);
    this.grantsCompletedDisplayed = (this.grants.filter(g => g.completed) || []).slice(0, this.grantsPerPage - this.grantsActiveDisplayed.length);
  }

  /**
   * @method _reset
   * @description clear all page data, called on connected and when expertId changes
   */
  _reset() {
    let acExpertId = APP_CONFIG.user?.expertId;
    let impersonatingExpertId = APP_CONFIG.impersonating?.expertId;

    this.expert = {};
    this.expertName = '';
    this.introduction = '';
    this.showMoreAboutMeLink = false;
    this.truncateIntroduction = false;
    this.truncateResearchInterests = false;
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
    this.totalGrants = 0;
    this.totalCitations = 0;
    this.canEdit = (acExpertId === this.expertId || impersonatingExpertId === this.expertId);
    this.modalTitle = '';
    this.modalContent = '';
    this.showModal = false;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = false;
    this.resultsPerPage = 25;
    this.grantsPerPage = 5;
    this.worksPerPage = 10;

    if( !this.expertImpersonating ) {
      this.expertImpersonating = '';
      this.hideImpersonate = (
        ((acExpertId && acExpertId !== this.expertId) &&
        (impersonatingExpertId && impersonatingExpertId !== this.expertId)) ||
        !(APP_CONFIG.user?.roles || []).includes('admin')
      );
    }
  }

  /**
   * @method toggleAdminUi
   * @description toggle admin ui based on user expertId
   *
  */
  toggleAdminUi() {
    this.canEdit = (APP_CONFIG.user?.expertId === this.expertId || APP_CONFIG.impersonating?.expertId === this.expertId);
  }

  _showMoreAboutMeClick(e) {
    this.showMoreAboutMeLink = false;
    this.truncateIntroduction = false;
    this.truncateResearchInterests = false;
  }

  /**
   * @method _loadCitations
   * @description load citations for expert async
   *
   * @param {Boolean} all load all citations, not just first 25, used for downloading all citations
   */
  async _loadCitations(all=false) {
    let citations = JSON.parse(JSON.stringify((this.expert['@graph'] || []).filter(g => g.issued)));
    this.totalCitations = citations.length;
    citations = citations.filter(c => c.relatedBy?.['is-visible']);

    citations = citations.map(c => {
      let citation = { ...c };
      citation.title = Array.isArray(citation.title) ? citation.title.join(' | ') : citation.title;
      return citation;
    });

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
        '"' + (grant.type || '') + '"',                               // Type of Grant
        '"' + (grant.role || '') + '"',                               // Role of Grant
        '?', // List of contributors (role) {separate contributors by ";"}
      ]);
    });

    if( !body.length ) return;

    let headers = ['Title', 'Funding Agency', 'Grant Id', 'Start Date', 'End Date', 'Type of Grant', 'Role', 'List of Contributors'];
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
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = true;
  }

  /**
   * @method _editAboutMe
   * @description show modal with link to edit intro/research interests
   */
  _editAboutMe(e) {
    this.modalTitle = 'Edit Introduction';
    this.modalContent = `<p>Your profile introduction is managed view your <strong>UC Publication Management System</strong> profile's "About" section.</p><p>You will be redirected to this system.</p>`;
    this.showModal = true;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = true;
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

  /**
   * @method _impersonateClick
   * @description impersonate expert
   */
  _impersonateClick(e) {
    e.preventDefault();

    let user = APP_CONFIG.user;
    if( !user || !(user.roles || []).filter(r => r === 'admin')[0] ) return;

    this.hideImpersonate = true;
    this.expertImpersonating = this.expertId;

    APP_CONFIG.impersonating = {
      expertId : this.expertId,
      expertName : this.expertName
    };

    // dispatch event to fin-app
    this.dispatchEvent(
      new CustomEvent("impersonate", {})
    );

    this.canEdit = true;
  }

  /**
   * @method cancelImpersonate
   * @description cancel impersonating an expert
   */
  cancelImpersonate() {
    this.expertImpersonating = '';

    this.hideImpersonate = APP_CONFIG.user?.expertId === this.expertId;

    if( APP_CONFIG.user?.expertId !== this.expertId ) this.canEdit = false;
  }

  /**
   * @method _refreshProfileClicked
   * @description refresh expert profile
   */
  _refreshProfileClicked(e) {
    e.preventDefault();

    // TODO verify this user is who they say they are (logged in user)

    // TODO trigger api call to refresh profile

    this.modalTitle = 'Your Profile is Updating';
    this.modalContent = `<p>The latest data is currently being retrieved for your profile. You will receive an email confirmation when the process is complete.</p>`;
    this.showModal = true;
    this.hideCancel = true;
    this.hideSave = true;
    this.hideOK = false;
  }

}

customElements.define('app-expert', AppExpert);
