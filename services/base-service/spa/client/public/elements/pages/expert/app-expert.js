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
      hiddenGrants : { type : Number },
      hiddenCitations : { type : Number },
      canEdit : { type : Boolean },
      isAdmin : { type : Boolean },
      modalTitle : { type : String },
      modalSaveText : { type : String },
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
      expertEditing : { type : String },
      hideEdit : { type : Boolean },
      isVisible : { type : Boolean },
      elementsUserId : { type : String },
      hideAvailability : { type : Boolean },
      collabProjects : { type : Boolean },
      commPartner : { type : Boolean },
      industProjects : { type : Boolean },
      mediaInterviews : { type : Boolean }
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
    this.expertEditing = utils.getCookie('editingExpertId');

    if( e.location.page !== 'expert' ) return;
    window.scrollTo(0, 0);

    let expertId = e.location.pathname.substr(1);
    let modified = e.modifiedWorks || e.modifiedGrants;
    if( expertId === this.expertId && !modified ) return;

    this._reset();

    if( (this.expertEditing === expertId && expertId.length > 0) || APP_CONFIG.user?.expertId === expertId ) this.canEdit = true;
    if( !this.isAdmin && APP_CONFIG.user?.expertId !== expertId) this.canEdit = false;

    try {
      let expert = await this.ExpertModel.get(expertId, '', utils.getExpertApiOptions());
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
    if( e.id.includes('/works-download') || e.id.includes('/grants-download') ) return;

    this.expertId = e.id;
    this.expert = JSON.parse(JSON.stringify(e.payload));
    this.canEdit = APP_CONFIG.user.expertId === this.expertId || utils.getCookie('editingExpertId') === this.expertId;

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
        title : c.hasTitle?.prefLabel || c.hasTitle?.name,
        department : c.hasOrganizationalUnit?.prefLabel || c.hasOrganizationalUnit?.name,
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

      // create 'name' label with abbrev url if not present
      w.hasURL.forEach(url => {
        if( !url.name ) {
          // remove http(s)://, www., and trailing slashes
          url.name = url.url?.replace(/^(http:\/\/|https:\/\/)|www\.|\/*$/g, '');
        }

        try {
          // also set custom icon depending on type of website
          if( url['@type'].includes('URL_googlescholar') ) {
            url.icon = 'fa-google-scholar';
          } else if( url['@type'].includes('URL_researchgate') ) {
            url.icon = 'fa-researchgate';
          } else if( url['@type'].includes('URL_linkedin') ) {
            url.icon = 'fa-linkedin';
          } else if( url['@type'].includes('URL_twitter') ) {
            url.icon = 'fa-x-twitter';
          } else if( url['@type'].includes('URL_mendeley') ) {
            url.icon = 'fa-mendeley';
          } else if( url['@type'].includes('URL_rssfeed') ) {
            url.icon = 'fa-square-rss';
          } else if( url['@type'].includes('URL_figshare') ) {
            url.icon = 'ai-figshare';
          }
        } catch(e) {
          console.warn('error setting website icon', e);
        }
      });

      this.websites.push(...w.hasURL);
    });

    await this._loadCitations();

    this.totalCitations = this.expert?.totals?.works || 0;
    this.hiddenCitations = this.expert?.totals?.hiddenWorks || 0;

    let grants = JSON.parse(JSON.stringify((this.expert['@graph'] || []).filter(g => g['@type'].includes('Grant'))));
    this.totalGrants = this.expert?.totals?.grants || 0;
    this.hiddenGrants = this.expert?.totals?.hiddenGrants || 0;

    this.grants = utils.parseGrants(this.expertId, grants);

    this.grantsActiveDisplayed = (this.grants.filter(g => !g.completed) || []).slice(0, this.grantsPerPage);
    this.grantsCompletedDisplayed = (this.grants.filter(g => g.completed) || []).slice(0, this.grantsPerPage - this.grantsActiveDisplayed.length);

    // availability
    let availLabels = {
      collab : 'Collaborative projects',
      community : 'Community partnerships',
      industry : 'Industry Projects',
      media : 'Media enquiries'
    };

    this.collabProjects = graphRoot.hasAvailability.some(a => a.prefLabel === availLabels.collab);
    this.commPartner = graphRoot.hasAvailability.some(a => a.prefLabel === availLabels.community);
    this.industProjects = graphRoot.hasAvailability.some(a => a.prefLabel === availLabels.industry);
    this.mediaInterviews = graphRoot.hasAvailability.some(a => a.prefLabel === availLabels.media);
  }

  /**
   * @method _reset
   * @description clear all page data, called on connected and when expertId changes
   */
  _reset() {
    let acExpertId = APP_CONFIG.user?.expertId;
    let editingExpertId = utils.getCookie('editingExpertId');

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
    this.hiddenGrants = 0;
    this.hiddenCitations = 0;
    this.canEdit = (acExpertId === this.expertId || (editingExpertId === this.expertId && this.expertId.length > 0));
    this.modalTitle = '';
    this.modalSaveText = '';
    this.modalContent = '';
    this.showModal = false;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = false;
    this.hideOaPolicyLink = false;
    this.errorMode = false;
    this.grantsPerPage = 5;
    this.worksPerPage = 10;
    this.isAdmin = (APP_CONFIG.user?.roles || []).includes('admin');
    this.modalAction = '';
    this.isVisible = true;
    this.elementsUserId = '';
    this.hideAvailability = true;
    this.collabProjects = false;
    this.commPartner = false;
    this.industProjects = false;
    this.mediaInterviews = false;

    if( !this.expertEditing ) {
      this.expertEditing = '';
      this.hideEdit = (
        (!this.isAdmin && acExpertId && acExpertId !== this.expertId) ||
        (editingExpertId && editingExpertId !== this.expertId) ||
        !this.isAdmin
      );
    }
  }

  /**
   * @method toggleAdminUi
   * @description toggle admin ui based on user expertId
   *
  */
  toggleAdminUi() {
    this.canEdit = (APP_CONFIG.user?.expertId === this.expertId || utils.getCookie('editingExpertId') === this.expertId);
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
   * @param {Boolean} all load all citations, not just first 10, used for downloading all citations
   * @param {Object} apiResponse optional response from ExpertModel.get
   */
  async _loadCitations(all=false, apiResponse={}) {
    let citations = all ? JSON.parse(JSON.stringify((apiResponse['@graph'] || []).filter(g => g.issued))) : JSON.parse(JSON.stringify((this.expert['@graph'] || []).filter(g => g.issued)));

    citations = citations.map(c => {
      let citation = { ...c };
      citation.title = Array.isArray(citation.title) ? citation.title.join(' | ') : citation.title;
      return citation;
    });

    if( !all ) this.citations = citations;

    let citationResults = all ? await Citation.generateCitations(citations) : await Citation.generateCitations(this.citations.slice(0, this.worksPerPage));
    citationResults = citationResults.map(c => c.value || c.reason?.data);

    // also remove issued date from citations if not first displayed on page from that year
    let lastPrintedYear;
    citationResults.forEach((cite, i) => {
      if( !Array.isArray(cite.issued) ) cite.issued = cite.issued.split('-');
      let newIssueDate = cite.issued?.[0];
      if( i > 0 && ( newIssueDate === citationResults[i-1].issued?.[0] || lastPrintedYear === newIssueDate ) ) {
        delete cite.issued;
        lastPrintedYear = newIssueDate;
      }
    });

    // update doi links to be anchor tags
    citationResults.forEach(cite => {
      if( cite.DOI && cite.apa ) {
        // https://doi.org/10.3389/fvets.2023.1132810</div>\n</div>
        cite.apa = cite.apa.split(`https://doi.org/${cite.DOI}`)[0]
                  + `<a href="https://doi.org/${cite.DOI}">https://doi.org/${cite.DOI}</a>`
                  + cite.apa.split(`https://doi.org/${cite.DOI}`)[1];
      }
    });

    if( all ) return citationResults;

    this.citationsDisplayed = citationResults;
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

    let res = await this.ExpertModel.get(
      this.expertId,
      '/works-download', // subpage
      utils.getExpertApiOptions({
        includeGrants : false,
        worksSize : 10000,
        includeHidden : false
      })
    );

    let allCitations = await this._loadCitations(true, res.payload);

    let text = allCitations.map(c => c.ris).join('\n');
    let blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    let url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'works.ris');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if( window.gtag ) gtag('event', 'citation_download', {});
  }

  /**
   * @method _downloadGrants
   * @description bound to click events of download button in grants list. download csv file of all grants
   *
   * @param {Object} e click|keyup event
   */
  async _downloadGrants(e) {
    e.preventDefault();

    let res = await this.ExpertModel.get(
      this.expertId,
      '/grants-download', // subpage
      utils.getExpertApiOptions({
        includeWorks : false,
        grantsSize : 10000,
        includeHidden : false
      })
    );

    let allGrants = JSON.parse(JSON.stringify((res?.payload?.['@graph'] || []).filter(g => g['@type'].includes('Grant'))));
    allGrants = utils.parseGrants(this.expertId, allGrants);

    let body = [];
    allGrants.forEach(grant => {
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

    let headers = ['Title', 'Funding Agency', 'Grant Id', 'Start Date', 'End Date', 'Type of Grant', 'Role', 'List of PIs and CoPIs'];
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

    if( window.gtag ) gtag('event', 'grant_download', {});
  }

  /**
   * @method _seeAllGrants
   * @description load page to list all grants
   */
  _seeAllGrants(e) {
    e.preventDefault();

    this.AppStateModel.setLocation('/'+this.expertId+'/grants/25/1/');
  }

  /**
   * @method _seeAllWorks
   * @description load page to list all works
   */
  _seeAllWorks(e) {
    e.preventDefault();
    this.AppStateModel.setLocation('/'+this.expertId+'/works/25/1/');
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

        if( window.gtag ) {
          gtag('event', 'expert_is_visible', {
            'description': 'expert ' + this.expertId + ' hidden',
            'expertId': this.expertId,
            'fatal': false
          });
        }
      } catch (error) {
        this.dispatchEvent(new CustomEvent("loaded", {}));
        let modelContent = `
          <p>
            <strong>Expert</strong> could not be updated. Please try again later or make your changes directly in the
            <a href="https://oapolicy.universityofcalifornia.edu/" target="_blank">UC Publication Management System (opens in new tab).</a>
          </p>`;

        this.modalTitle = 'Error: Update Failed';
        this.modalSaveText = '';
        this.modalContent = modelContent;
        this.showModal = true;
        this.hideCancel = true;
        this.hideSave = true;
        this.hideOK = false;
        this.hideOaPolicyLink = true;
        this.errorMode = true;

        if( window.gtag ) {
          gtag('event', 'expert_is_visible', {
            'description': 'attempted to hide expert ' + this.expertId + ' but failed',
            'expertId': this.expertId,
            'fatal': false
          });
        }
      }
    } else if( this.modalAction === 'delete-expert' ) {
      this.dispatchEvent(new CustomEvent("loading", {}));
      try {
        let res = await this.ExpertModel.deleteExpert(this.expertId);
        this.dispatchEvent(new CustomEvent("loaded", {}));

        if( window.gtag ) {
          gtag('event', 'expert_delete', {
            'description': 'expert ' + this.expertId + ' deleted',
            'expertId': this.expertId,
            'fatal': false
          });
        }

        // redirect to home page
        this.AppStateModel.setLocation('/');
      } catch (error) {
        this.dispatchEvent(new CustomEvent("loaded", {}));
        let modelContent = `
          <p>
            <strong>Expert</strong> could not be updated. Please try again later or make your changes directly in the
            <a href="https://oapolicy.universityofcalifornia.edu/" target="_blank">UC Publication Management System (opens in new tab).</a>
          </p>`;

        this.modalTitle = 'Error: Update Failed';
        this.modalSaveText = '';
        this.modalContent = modelContent;
        this.showModal = true;
        this.hideCancel = true;
        this.hideSave = true;
        this.hideOK = false;
        this.hideOaPolicyLink = true;
        this.errorMode = true;

        if( window.gtag ) {
          gtag('event', 'expert_delete', {
            'description': 'attempted to delete expert ' + this.expertId + ' but failed',
            'expertId': this.expertId,
            'fatal': false
          });
        }
      }

    } else if( this.modalAction === 'edit-websites' || this.modalAction === 'edit-about-me' ) {
      let elementsEditMode = APP_CONFIG.user.expertId === this.expertId ? '&em=true' : '';
      window.open(`https://oapolicy.universityofcalifornia.edu${this.elementsUserId.length > 0 ? '/userprofile.html?uid=' + this.elementsUserId + elementsEditMode : ''}`, '_blank');
    } else if( this.modalAction === 'edit-roles' ) {
      window.open('https://org.ucdavis.edu/odr/', '_blank');
    } else if( this.modalAction === 'edit-availability' ) {
      // save availability to cdl
      this.dispatchEvent(new CustomEvent("loading", {}));
      try {
        let collabProjects = e.currentTarget?.shadowRoot?.querySelector('#collab-projects')?.checked || false;
        let commPartner = e.currentTarget?.shadowRoot?.querySelector('#comm-partner')?.checked || false;
        let industProjects = e.currentTarget?.shadowRoot?.querySelector('#indust-projects')?.checked || false;
        let mediaInterviews = e.currentTarget?.shadowRoot?.querySelector('#media-interviews')?.checked || false;

        let openTo = {
          collabProjects,
          commPartner,
          industProjects,
          mediaInterviews
        };
        let prevOpenTo = {
          collabProjects : this.collabProjects,
          commPartner : this.commPartner,
          industProjects : this.industProjects,
          mediaInterviews : this.mediaInterviews
        };
        let labels = utils.buildAvailabilityPayload(openTo, prevOpenTo);

        let res = await this.ExpertModel.updateExpertAvailability(this.expertId, labels);
        this.dispatchEvent(new CustomEvent("loaded", {}));

        if( window.gtag ) {
          gtag('event', 'expert_availability_change', {
            'description': 'expert ' + this.expertId + ' availablity label change',
            'expertId': this.expertId,
            'fatal': false
          });
        }

        this.collabProjects = collabProjects;
        this.commPartner = commPartner;
        this.industProjects = industProjects;
        this.mediaInterviews = mediaInterviews;
        this.hideAvailability = (!this.collabProjects && !this.commPartner && !this.industProjects && !this.mediaInterviews);

      } catch (error) {
        this.dispatchEvent(new CustomEvent("loaded", {}));

        let elementsEditMode = APP_CONFIG.user.expertId === this.expertId ? '&em=true' : '';
        let modelContent = `
          <p>
            <strong>Availability labels</strong> could not be updated. Please try again later or make your changes directly in the
            <a href="https://oapolicy.universityofcalifornia.edu${this.elementsUserId.length > 0 ? '/userprofile.html?uid=' + this.elementsUserId + elementsEditMode : ''}" target="_blank">UC Publication Management System (opens in new tab).</a>
          </p>
        `;

        this.modalTitle = 'Error: Update Failed';
        this.modalSaveText = '';
        this.modalContent = modelContent;
        this.showModal = true;
        this.hideCancel = true;
        this.hideSave = true;
        this.hideOK = false;
        this.hideOaPolicyLink = true;
        this.errorMode = true;

        if( window.gtag ) {
          gtag('event', 'expert_availability_change', {
            'description': 'attempted to change availability labels for expert ' + this.expertId + ' but failed',
            'expertId': this.expertId,
            'fatal': false
          });
        }
      }
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

        if( window.gtag ) {
          gtag('event', 'expert_is_visible', {
            'description': 'expert ' + this.expertId + ' shown',
            'expertId': this.expertId,
            'fatal': false
          });
        }
      } catch (error) {
        this.dispatchEvent(new CustomEvent("loaded", {}));
        let modelContent = `
          <p>
            <strong>Expert</strong> could not be updated. Please try again later or make your changes directly in the
            <a href="https://oapolicy.universityofcalifornia.edu/" target="_blank">UC Publication Management System (opens in new tab).</a>
          </p>`;

        this.modalTitle = 'Error: Update Failed';
        this.modalSaveText = '';
        this.modalContent = modelContent;
        this.showModal = true;
        this.hideCancel = true;
        this.hideSave = true;
        this.hideOK = false;
        this.hideOaPolicyLink = true;
        this.errorMode = true;

        if( window.gtag ) {
          gtag('event', 'expert_is_visible', {
            'description': 'attempted to show expert ' + this.expertId + ' but failed',
            'expertId': this.expertId,
            'fatal': false
          });
        }
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
    this.modalSaveText = '';
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
    this.modalSaveText = '';
    this.modalContent = `<p>The expert will be removed from Aggie Experts. In the <a href="https://oapolicy.universityofcalifornia.edu">UC Publication Management System</a> their privacy will be set to internal. To show the expert again in Aggie Experts, you would need to update the privacy setting to public in the UC Publication Management System. Are you sure you would like to continue?</p>`;
    this.showModal = true;
    this.hideCancel = true;
    this.hideSave = false;
    this.hideOK = true;
    this.hideOaPolicyLink = true;
    this.errorMode = false;
  }

  /**
   * @method _editAvailability
   * @description show modal confirming expert availibility changes to cdl
   */
  _editAvailability(e) {
    this.modalAction = 'edit-availability';
    this.modalTitle = 'Edit Availability';
    this.modalSaveText = 'Save Changes';
    this.modalContent = `
      <p>I am open to:</p>
      <label style="display: flex; align-items: center; line-height: 1.92125rem;"><input style="margin-right: .4rem;" type="checkbox" id="collab-projects" name="collab-projects" value="collab-projects" ${this.collabProjects ? 'checked' : ''}> Collaborative Projects </label>
      <label style="display: flex; align-items: center; line-height: 1.92125rem;"><input style="margin-right: .4rem;" type="checkbox" id="comm-partner" name="comm-partner" value="comm-partner" ${this.commPartner ? 'checked' : ''}> Community Partnerships </label>
      <label style="display: flex; align-items: center; line-height: 1.92125rem;"><input style="margin-right: .4rem;" type="checkbox" id="indust-projects" name="indust-projects" value="indust-projects" ${this.industProjects ? 'checked' : ''}> Industry Projects </label>
      <label style="display: flex; align-items: center; line-height: 1.92125rem;"><input style="margin-right: .4rem;" type="checkbox" id="media-interviews" name="media-interviews" value="media-interviews" ${this.mediaInterviews ? 'checked' : ''}> Media Interviews </label>
    `;
    this.showModal = true;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = true;
    this.hideOaPolicyLink = true;
    this.errorMode = false;
  }

  /**
   * @method _editRoles
   * @description show modal with link to edit roles
   */
  _editRoles(e) {
    this.modalAction = 'edit-roles';
    this.modalTitle = 'Edit Roles';
    this.modalSaveText = '';
    this.modalContent = `<p>Academic roles and titles are managed via the <strong>UC Davis Online Directory.</strong></p><p>You will be redirected to this system in a new tab.</p>`;
    this.showModal = true;
    this.hideCancel = false;
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
    this.modalSaveText = '';
    this.modalContent = `<p>Links are managed via your <strong>UC Publication Management System</strong> profile's "Web addresses and social media" section.</p><p>You will be redirected to this system in a new tab.</p>`;
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
    this.modalSaveText = '';
    this.modalContent = `<p>Your profile introduction is managed view your <strong>UC Publication Management System</strong> profile's "About" section.</p><p>You will be redirected to this system in a new tab.</p>`;
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

    this.AppStateModel.setLocation('/'+this.expertId+'/grants-edit/25/1/');
  }

  /**
   * @method _editWorks
   * @description load page to list all works in edit mode
   */
  _editWorks(e) {
    e.preventDefault();

    this.AppStateModel.setLocation('/'+this.expertId+'/works-edit/25/1/');
  }

  /**
   * @method _editExpertClick
   * @description edit expert
   */
  _editExpertClick(e) {
    e.preventDefault();

    let user = APP_CONFIG.user;
    if( !user || !(user.roles || []).filter(r => r === 'admin')[0] ) return;

    this.hideEdit = true;
    this.expertEditing = this.expertId;


    // dispatch event to fin-app
    this.dispatchEvent(
      new CustomEvent("cancel-edit-expert", {
        detail : {
          expertId : this.expertId,
          expertName : this.expertName
        }
      })
    );

    this.canEdit = true;
  }

  /**
   * @method cancelEditExpert
   * @description cancel editing an expert
   */
  cancelEditExpert() {
    this.expertEditing = '';

    this.hideEdit = APP_CONFIG.user?.expertId === this.expertId;

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
    this.modalSaveText = '';
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
    this.modalSaveText = '';
    let rejectFailureMsg = `<p>Rejecting (Title of Work) could not be done through Aggie Experts right now. Please, try again later, or make changes directly in the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management System.</a></p><p>For more help, see <a href="/faq#reject-publication">troubleshooting tips.</a></p>`;
    let visibilityFailureMsgGrant = `<p>Changes to the visibility of (Title of Grant) could not be done through Aggie Experts right now. Please, try again later, or make changes directly in the <a href="https://oapolicy.universityofcalifornia.edu/listobjects.html?as=1&am=false&cid=2&oa=&tol=&tids=&f=&rp=&vs=&nad=&rs=&efa=&sid=&y=&ipr=true&jda=&iqf=&id=&wt=">UC Publication Management System.</a></p><p>For more help, see <a href="/faq#visible-publication">troubleshooting tips.</a></p>`;
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
