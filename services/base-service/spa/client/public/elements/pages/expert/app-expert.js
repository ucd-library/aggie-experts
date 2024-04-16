import { LitElement } from 'lit';
import {render} from "./app-expert.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

import '@ucd-lib/theme-elements/ucdlib/ucdlib-md/ucdlib-md.js';
import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../../utils/app-icons.js';
import '../../components/modal-overlay.js';

import Citation from '../../../lib/utils/citation.js';
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
      isAdmin : { type : Boolean },
      modalTitle : { type : String },
      modalContent : { type : String },
      modalAction : { type : String },
      showModal : { type : Boolean },
      hideCancel : { type : Boolean },
      hideSave : { type : Boolean },
      hideOK : { type : Boolean },
      hideOaPolicyLink : { type : Boolean },
      errorMode : { type : Boolean },
      grantsPerPage : { type : Number },
      worksPerPage : { type : Number },
      expertImpersonating : { type : String },
      hideImpersonate : { type : Boolean },
      isVisible : { type : Boolean },
      elementsUserId : { type : String }
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
    this.expertImpersonating = utils.getCookie('impersonateId');

    if( e.location.page !== 'expert' ) return;
    window.scrollTo(0, 0);

    let expertId = e.location.pathname.substr(1);
    let modified = e.modifiedWorks || e.modifiedGrants;
    if( expertId === this.expertId && !modified ) return;

    this._reset();

    if( (this.expertImpersonating === expertId && expertId.length > 0) || APP_CONFIG.user?.expertId === expertId ) this.canEdit = true;
    if( !this.isAdmin && APP_CONFIG.user?.expertId !== expertId) this.canEdit = false;

    try {
      let expert = await this.ExpertModel.get(expertId, this.canEdit);
      this._onExpertUpdate(expert, modified);

      if( !this.isAdmin && !this.isVisible ) throw new Error();
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
   * @return {Boolean} modified
   */
  async _onExpertUpdate(e, modified=false) {
    if( e.state !== 'loaded' ) return;
    if( this.AppStateModel.location.page !== 'expert' ) return;
    if( e.id === this.expertId && !modified ) return;

    this.expertId = e.id;
    this.expert = JSON.parse(JSON.stringify(e.payload));
    this.canEdit = APP_CONFIG.user.expertId === this.expertId || utils.getCookie('impersonateId') === this.expertId;

    this.isVisible = this.expert['is-visible'];

    // update page data
    let graphRoot = (this.expert['@graph'] || []).filter(item => item['@id'] === this.expertId)[0];
    this.elementsUserId = graphRoot.identifier?.filter(i => i.includes('/user'))?.[0]?.split('/')?.pop() || '';

    this.expertName = graphRoot.hasName?.given + (graphRoot.hasName?.middle ? ' ' + graphRoot.hasName.middle : '') + ' ' + graphRoot.hasName?.family;

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

    let websites = graphRoot.contactInfo?.filter(c => (!c['isPreferred'] || c['isPreferred'] === false) && c['rank'] === 20 && c.hasURL);
    websites.forEach(w => {
      if( !Array.isArray(w.hasURL) ) w.hasURL = [w.hasURL];
      this.websites.push(...w.hasURL);
    });

    await this._loadCitations();

    let grants = JSON.parse(JSON.stringify((this.expert['@graph'] || []).filter(g => g['@type'].includes('Grant'))));
    this.totalGrants = grants.length;

    this.grants = utils.parseGrants(this.expertId, grants);

    this.grantsActiveDisplayed = (this.grants.filter(g => !g.completed) || []).slice(0, this.grantsPerPage);
    this.grantsCompletedDisplayed = (this.grants.filter(g => g.completed) || []).slice(0, this.grantsPerPage - this.grantsActiveDisplayed.length);

    console.log({ grants : this.grants });
  }

  /**
   * @method _reset
   * @description clear all page data, called on connected and when expertId changes
   */
  _reset() {
    let acExpertId = APP_CONFIG.user?.expertId;
    let impersonatingExpertId = utils.getCookie('impersonateId');

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
    this.canEdit = (acExpertId === this.expertId || (impersonatingExpertId === this.expertId && this.expertId.length > 0));
    this.modalTitle = '';
    this.modalContent = '';
    this.showModal = false;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = false;
    this.hideOaPolicyLink = false;
    this.errorMode = false;
    this.resultsPerPage = 25;
    this.grantsPerPage = 5;
    this.worksPerPage = 10;
    this.isAdmin = (APP_CONFIG.user?.roles || []).includes('admin');
    this.modalAction = '';
    this.isVisible = true;
    this.elementsUserId = '';

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
    this.canEdit = (APP_CONFIG.user?.expertId === this.expertId || utils.getCookie('impersonateId') === this.expertId);
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

    citations = citations.map(c => {
      let citation = { ...c };
      citation.title = Array.isArray(citation.title) ? citation.title.join(' | ') : citation.title;
      return citation;
    });

    try {
      // sort by issued date desc, then by title asc
      citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]) || a.title.localeCompare(b.title))
    } catch (error) {
      // validate issue date
      let validation = Citation.validateIssueDate(citations);
      if( validation.citations?.length ) console.warn(validation.error, validation.citations);

      // validate title
      validation = Citation.validateTitle(citations);
      if( validation.citations?.length ) console.warn(validation.error, validation.citations);

      // filter out invalid citations
      citations = citations.filter(c => typeof c.issued === 'string' && typeof c.title === 'string');

      this.totalCitations = citations.length;
    }

    // filter out non is-visible citations
    let citationValidation = Citation.validateIsVisible(citations);
    if( citationValidation.citations?.length ) console.warn(citationValidation.error, citationValidation.citations);
    citations = citations.filter(c => c.relatedBy?.['is-visible']);

    this.citations = citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]) || a.title.localeCompare(b.title))
    let citationResults = all ? await Citation.generateCitations(this.citations) : await Citation.generateCitations(this.citations.slice(0, this.worksPerPage));

    this.citationsDisplayed = citationResults.map(c => c.value || c.reason?.data);

    // also remove issued date from citations if not first displayed on page from that year
    let lastPrintedYear;
    this.citationsDisplayed.forEach((cite, i) => {
      if( !Array.isArray(cite.issued) ) cite.issued = cite.issued.split('-');
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

    gtag('event', 'works_download', {});
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
        '"' + grant.types.join(', ') + '"',                           // Type of Grant
        '"' + (grant.role || '') + '"',                               // Role of Grant
        '"' + grant.contributors.map(c => c.name).join('; ') + '"',   // List of contributors (CoPIs)
      ]);
    });

    if( !body.length ) return;

    let headers = ['Title', 'Funding Agency', 'Grant Id', 'Start Date', 'End Date', 'Type of Grant', 'Role', 'List of CoPIs'];
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

    gtag('event', 'grants_download', {});
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
   * @method _onSave
   * @description modal save, only used when hiding expert
   */
  async _onSave(e) {
    this.showModal = false;

    if( this.isAdmin && this.modalAction === 'hide-expert' ) {
      this.dispatchEvent(new CustomEvent("loading", {}));
      try {
        let res = await this.ExpertModel.updateExpertVisibility(this.expertId, false);
        this.dispatchEvent(new CustomEvent("loaded", {}));
        this.isVisible = false;
      } catch (error) {
        this.dispatchEvent(new CustomEvent("loaded", {}));
        let modelContent = `<p>Hiding expert could not be done through Aggie Experts right now. Please, try again later, or make changes directly in the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management System.</a></p>`;

        this.modalTitle = 'Error: Update Failed';
        this.modalContent = modelContent;
        this.showModal = true;
        this.hideCancel = true;
        this.hideSave = true;
        this.hideOK = false;
        this.hideOaPolicyLink = true;
        this.errorMode = true;
      }
    } else if( this.isAdmin && this.modalAction === 'delete-expert' ) {
      this.dispatchEvent(new CustomEvent("loading", {}));
      try {
        let res = await this.ExpertModel.deleteExpert(this.expertId);
        this.dispatchEvent(new CustomEvent("loaded", {}));
        // redirect to home page
        this.AppStateModel.setLocation('/');
      } catch (error) {
        this.dispatchEvent(new CustomEvent("loaded", {}));
        let modelContent = `<p>Deleting expert could not be done through Aggie Experts right now. Please, try again later, or make changes directly in the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management System.</a></p>`;

        this.modalTitle = 'Error: Update Failed';
        this.modalContent = modelContent;
        this.showModal = true;
        this.hideCancel = true;
        this.hideSave = true;
        this.hideOK = false;
        this.hideOaPolicyLink = true;
        this.errorMode = true;
      }

    } else if( this.modalAction === 'edit-websites' || this.modalAction === 'edit-about-me' ) {
      let elementsEditMode = APP_CONFIG.user.expertId === this.expertId ? '&em=true' : '';
      window.open(`https://oapolicy.universityofcalifornia.edu${this.elementsUserId.length > 0 ? '/userprofile.html?uid=' + this.elementsUserId + elementsEditMode : ''}`, '_blank');
    }

    this.modalAction = '';
  }

  /**
   * @method _showExpert
   * @description update expert visibility to true
   */
  async _showExpert(e) {
    if( this.isAdmin ) {
      this.dispatchEvent(new CustomEvent("loading", {}));
      try {
        let res = await this.ExpertModel.updateExpertVisibility(this.expertId, true);
        this.dispatchEvent(new CustomEvent("loaded", {}));
        this.isVisible = true;
      } catch (error) {
        this.dispatchEvent(new CustomEvent("loaded", {}));
        let modelContent = `<p>Showing expert could not be done through Aggie Experts right now. Please, try again later, or make changes directly in the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management System.</a></p>`;

        this.modalTitle = 'Error: Update Failed';
        this.modalContent = modelContent;
        this.showModal = true;
        this.hideCancel = true;
        this.hideSave = true;
        this.hideOK = false;
        this.hideOaPolicyLink = true;
        this.errorMode = true;
      }
    }
  }

  /**
   * @method _hideExpert
   * @description show modal confirming expert should be hidden
   */
  _hideExpert(e) {
    this.modalAction = 'hide-expert';
    this.modalTitle = 'Hide Expert';
    this.modalContent = `<p>The expert will be hidden from Aggie Experts, but this change will not appear in Elements. This is a safeguard available only to admins, in case "Delete Expert" does not work because Elements is not reachable. It is the admin's responsibility to manually change visibility in Elements. Are you sure you would like to continue?</p>`;
    this.showModal = true;
    this.hideCancel = true;
    this.hideSave = false;
    this.hideOK = true;
    this.hideOaPolicyLink = true;
    this.errorMode = false;
  }

  /**
   * @method _deleteExpert
   * @description show modal confirming expert should be deleted from Aggie Experts and CDL
   */
  _deleteExpert(e) {
    this.modalAction = 'delete-expert';
    this.modalTitle = 'Delete Expert';
    this.modalContent = `<p>The expert will be removed from Aggie Experts. In the <a href="https://oapolicy.universityofcalifornia.edu">UC Publication Management System</a> their privacy will be set to internal. To show the expert again in Aggie Experts, you would need to update the privacy setting to public in the UC Publication Management System. Are you sure you would like to continue?</p>`;
    this.showModal = true;
    this.hideCancel = true;
    this.hideSave = false;
    this.hideOK = true;
    this.hideOaPolicyLink = true;
    this.errorMode = false;
  }

  /**
   * @method _editWebsites
   * @description show modal with link to edit websites
   */
  _editWebsites(e) {
    this.modalAction = 'edit-websites';
    this.modalTitle = 'Edit Links';
    this.modalContent = `<p>Links are managed via your <strong>UC Publication Management System</strong> profile's "Web addresses and social media" section.</p><p>You will be redirected to this system.</p>`;
    this.showModal = true;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = true;
    this.hideOaPolicyLink = true;
    this.errorMode = false;
  }

  /**
   * @method _editAboutMe
   * @description show modal with link to edit intro/research interests
   */
  _editAboutMe(e) {
    this.modalAction = 'edit-about-me';
    this.modalTitle = 'Edit Introduction';
    this.modalContent = `<p>Your profile introduction is managed view your <strong>UC Publication Management System</strong> profile's "About" section.</p><p>You will be redirected to this system.</p>`;
    this.showModal = true;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = true;
    this.hideOaPolicyLink = true;
    this.errorMode = false;
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


    // dispatch event to fin-app
    this.dispatchEvent(
      new CustomEvent("impersonate", {
        detail : {
          expertId : this.expertId,
          expertName : this.expertName
        }
      })
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
    this.hideOaPolicyLink = true;
    this.errorMode = false;
  }

  _cdlErrorModal(e) {
    e.preventDefault();

    this.modalTitle = 'Error: Update Failed';
    let rejectFailureMsg = `<p>Rejecting (Title of Work) could not be done through Aggie Experts right now. Please, try again later, or make changes directly in the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management System.</a></p><p>For more help, see <a href="/faq#reject-publication">troubleshooting tips.</a></p>`;
    let visibilityFailureMsgGrant = `<p>Changes to the visibility of (Title of Grant) could not be done through Aggie Experts right now. Please, try again later, or make changes directly in the <a href="https://qa-oapolicy.universityofcalifornia.edu/listobjects.html?as=1&am=false&cid=2&oa=&tol=&tids=&f=&rp=&vs=&nad=&rs=&efa=&sid=&y=&ipr=true&jda=&iqf=&id=&wt=">UC Publication Management System.</a></p><p>For more help, see <a href="/faq#visible-publication">troubleshooting tips.</a></p>`;
    let visibilityFailureMsgWork = `<p>Changes to the visibility of (Title of Work) could not be done through Aggie Experts right now. Please, try again later, or make changes directly in the <a href="https://oapolicy.universityofcalifornia.edu/listobjects.html?as=1&am=false&cid=1&tids=5&ipr=true">UC Publication Management System.</a></p><p>For more help, see <a href="/faq#visible-publication">troubleshooting tips.</a></p>`;

    this.modalContent = rejectFailureMsg;
    this.showModal = true;
    this.hideCancel = true;
    this.hideSave = true;
    this.hideOK = false;
    this.hideOaPolicyLink = true;
    this.errorMode = true;
  }

}

customElements.define('app-expert', AppExpert);
