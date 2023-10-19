import { LitElement } from 'lit';
import {render} from "./app-expert.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

import '@ucd-lib/theme-elements/ucdlib/ucdlib-md/ucdlib-md.js';
import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../../utils/app-icons.js';
import '../../components/modal-overlay.js';

import { generateCitations } from '../../utils/citation.js';

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
      canEdit : { type : Boolean },
      modalTitle : { type : String },
      modalContent : { type : String },
      showModal : { type : Boolean }
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
    console.log('app-expert expert payload', this.expert);

    // update page data
    let graphRoot = this.expert['@graph'].filter(item => item['@id'] === this.expertId)[0];

    console.log('app-expert expert graphRoot', graphRoot);
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
    this.canEdit = true;
    this.modalTitle = '';
    this.modalContent = '';
    this.showModal = false;
    this.resultsPerPage = 25;
  }

  /**
   * @method _loadCitations
   * @description load citations for expert async
   *
   * @param {Boolean} all load all citations, not just first 25, used for downloading all citations
   */
  async _loadCitations(all=false) {
    let citations = JSON.parse(JSON.stringify(this.expert['@graph'].filter(g => g.issued)));

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
    let citationResults = all ? await generateCitations(this.citations) : await generateCitations(this.citations.slice(0, this.resultsPerPage));

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
   * @description bound to click events of download button in works list
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
    this.modalTitle = 'Edit Websites';
    this.modalContent = `<p>Websites are managed via your <strong>UC Publication Management System</strong> profile's "Web addresses and social media" section.</p><p>You will be redirected to this system.</p>`;
    this.showModal = true;
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
