import { LitElement } from 'lit';
import {render} from "./app-expert-works-list-edit.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";
import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";
import '../../components/modal-overlay.js';

import Citation from '../../../lib/utils/citation.js';

import utils from '../../../lib/utils';

export default class AppExpertWorksListEdit extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      expertId : { type : String },
      expert : { type : Object },
      expertName : { type : String },
      citations : { type : Array },
      citationsDisplayed : { type : Array },
      totalCitations : { type : Number },
      hiddenCitations : { type : Number },
      paginationTotal : { type : Number },
      currentPage : { type : Number },
      allSelected : { type : Boolean },
      showModal : { type : Boolean },
      hideCancel : { type : Boolean },
      hideSave : { type : Boolean },
      hideOK : { type : Boolean },
      hideOaPolicyLink : { type : Boolean },
      errorMode : { type : Boolean },
      downloads : { type : Array },
      resultsPerPage : { type : Number },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'ExpertModel');

    this._reset();

    this.render = render.bind(this);
  }

  _reset() {
    this.expertId = '';
    this.expert = {};
    this.expertName = '';
    this.citations = [];
    this.citationsDisplayed = [];
    this.totalCitations = 0;
    this.hiddenCitations = 0;
    this.paginationTotal = 1;
    this.currentPage = 1;
    this.resultsPerPage = 25;
    this.allSelected = false;
    this.showModal = false;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = false;
    this.hideOaPolicyLink = false;
    this.errorMode = false;
    this.downloads = [];
    this.isAdmin = (APP_CONFIG.user?.roles || []).includes('admin');
    this.isVisible = true;

    let selectAllCheckbox = this.shadowRoot?.querySelector('#select-all');
    if( selectAllCheckbox ) selectAllCheckbox.checked = false;
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
    if( e.location.page !== 'works-edit' ) {
      this._reset();
      return;
    }

    window.scrollTo(0, 0);

    this.modifiedWorks = false;
    let expertId = e.location.pathname.replace('/works-edit', '');
    if( expertId.substr(0,1) === '/' ) expertId = expertId.substr(1);

    let canEdit = (APP_CONFIG.user?.expertId === expertId || utils.getCookie('editingExpertId') === expertId);

    if( !expertId || !canEdit ) this.dispatchEvent(new CustomEvent("show-404", {}));

    try {
      let expert = await this.ExpertModel.get(expertId, canEdit);
      this._onExpertUpdate(expert);

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
   */
  async _onExpertUpdate(e) {
    if( e.state !== 'loaded' ) return;
    if( this.AppStateModel.location.page !== 'works-edit' ) return;

    this.expertId = e.id;
    this.expert = JSON.parse(JSON.stringify(e.payload));
    this.isVisible = this.expert['is-visible'];

    let graphRoot = (this.expert['@graph'] || []).filter(item => item['@id'] === this.expertId)[0];
    this.expertName = graphRoot.hasName?.given + (graphRoot.hasName?.middle ? ' ' + graphRoot.hasName.middle : '') + ' ' + graphRoot.hasName?.family;

    await this._loadCitations();
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
    this.hiddenCitations = citations.filter(c => !c.relatedBy?.['is-visible']).length;

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

    this.citations = citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]) || a.title.localeCompare(b.title))

    let startIndex = (this.currentPage - 1) * this.resultsPerPage || 0;
    let citationResults = all ? await Citation.generateCitations(this.citations) : await Citation.generateCitations(this.citations.slice(startIndex, startIndex + this.resultsPerPage));

    this.citationsDisplayed = citationResults.map(c => c.value || c.reason?.data);

    // also remove issued date from citations if not first displayed on page from that year
    let lastPrintedYear;
    this.citationsDisplayed.forEach((cite, i) => {
      if( !Array.isArray(cite.issued) ) cite.issued = cite.issued.split('-');
      let newIssueDate = cite.issued?.[0];
      if( i > 0 && ( newIssueDate === this.citationsDisplayed[i-1].issued?.[0] || lastPrintedYear === newIssueDate ) && i % this.resultsPerPage !== 0 ) {
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

    this.paginationTotal = Math.ceil(this.citations.length / this.resultsPerPage);

    this.requestUpdate();
  }

  /**
   * @method _onPaginationChange
   * @description bound to click events of the pagination element
   *
   * @param {Object} e click|keyup event
   */
  async _onPaginationChange(e) {
    this.allSelected = true;
    e.detail.startIndex = e.detail.page * this.resultsPerPage - this.resultsPerPage;
    let maxIndex = e.detail.page * (e.detail.startIndex || this.resultsPerPage);
    if( maxIndex > this.citations.length ) maxIndex = this.citations.length;

    this.currentPage = e.detail.page;
    await this._loadCitations();

    // loop over checkboxes to see if any are checked
    let checkboxes = this.shadowRoot.querySelectorAll('.select-checkbox input[type="checkbox"]') || [];
    checkboxes.forEach(checkbox => {
      if( this.downloads.includes(checkbox.dataset.id) ) {
        checkbox.checked = true;
      } else {
        checkbox.checked = false;
        this.allSelected = false;
      }
    });

    let selectAllCheckbox = this.shadowRoot.querySelector('#select-all');
    if( selectAllCheckbox && !this.allSelected ) {
      selectAllCheckbox.checked = false;
    } else if( selectAllCheckbox ) {
      selectAllCheckbox.checked = true;
    }

    window.scrollTo(0, 0);
  }

  /**
   * @method _selectAllChecked
   * @description bound to click events of Select All checkbox
   *
   * @param {Object} e click|keyup event
   */
  _selectAllChecked(e) {
    this.allSelected = e.currentTarget.checked;
    let checkboxes = this.shadowRoot.querySelectorAll('.select-checkbox input[type="checkbox"]') || [];
    checkboxes.forEach(checkbox => {
      checkbox.checked = this.allSelected;
      if( this.allSelected ) {
        if( !this.downloads.includes(checkbox.dataset.id) ) this.downloads.push(checkbox.dataset.id);
      } else {
        this.downloads = this.downloads.filter(d => d !== checkbox.dataset.id);
      }
    });
  }

  /**
   * @method _selectAllChecked
   * @description bound to click events of Select checkboxes
   *
   * @param {Object} e click|keyup event
   */
  _selectChecked(e) {
    let id = e.currentTarget.dataset.id;

    if( e.currentTarget.checked ) {
      this.downloads.push(id);
    } else {
      this.downloads = this.downloads.filter(d => d !== id);
      this.allSelected = false;
      let selectAllCheckbox = this.shadowRoot.querySelector('#select-all');
      if( selectAllCheckbox ) {
        selectAllCheckbox.checked = false;
      }
    }
  }

  /**
   * @method _downloadClicked
   * @description bound to click events of download button
   *
   * @param {Object} e click|keyup event
   */
  async _downloadClicked(e) {
    e.preventDefault();
    await this._loadCitations(true);

    let downloads = this.citationsDisplayed.filter(c => this.downloads.includes(c['@id']));

    let startIndex = (this.currentPage - 1) * this.resultsPerPage || 0;
    this.citationsDisplayed = this.citationsDisplayed.slice(startIndex, startIndex + this.resultsPerPage)

    let text = downloads.map(c => c.ris).join('\n');
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
   * @method _hideWork
   * @description show modal with link to hide work
   */
  _hideWork(e) {
    this.citationId = e.currentTarget.dataset.id;

    this.modalTitle = 'Hide Work';
    this.modalContent = `<p>This record will be <strong>hidden from your profile</strong> and marked as "Internal" in the UC Publication Management System.</p><p>Are you sure you want to hide this work?</p>`;
    this.showModal = true;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = true;
    this.hideOaPolicyLink = true;
    this.errorMode = false;
  }

  /**
   * @method _showWork
   * @description show work
   */
  async _showWork(e) {
    this.citationId = e.currentTarget.dataset.id;
    this.dispatchEvent(new CustomEvent("loading", {}));

    try {
      let res = await this.ExpertModel.updateCitationVisibility(this.expertId, this.citationId, true);
      this.dispatchEvent(new CustomEvent("loaded", {}));

      if( window.gtag ) {
        gtag('event', 'citation_is_visible', {
          'description': 'citation ' + this.citationId + ' shown for expert ' + this.expertId,
          'relationshipId': this.citationId,
          'expertId': this.expertId,
          'fatal': false
        });
      }
    } catch (error) {
      this.dispatchEvent(new CustomEvent("loaded", {}));

      let citationTitle = this.citations.filter(c => c.relatedBy?.['@id'] === this.citationId)?.[0]?.title || '';
      let modelContent = `<p>Changes to the visibility of (${citationTitle}) could not be done through Aggie Experts right now. Please, try again later, or make changes directly in the <a href="https://oapolicy.universityofcalifornia.edu/listobjects.html?as=1&am=false&cid=1&tids=5&ipr=true">UC Publication Management System.</a></p><p>For more help, see <a href="/faq#visible-publication">troubleshooting tips.</a></p>`;

      this.modalTitle = 'Error: Update Failed';
      this.modalContent = modelContent;
      this.showModal = true;
      this.hideCancel = true;
      this.hideSave = true;
      this.hideOK = false;
      this.hideOaPolicyLink = true;
      this.errorMode = true;

      if( window.gtag ) {
        gtag('event', 'citation_is_visible', {
          'description': 'attempted to show citation ' + this.citationId + ' for expert ' + this.expertId + ' but failed',
          'relationshipId': this.citationId,
          'expertId': this.expertId,
          'fatal': false
        });
      }

      return;
    }


    this.modifiedWorks = true;

    let expert = await this.ExpertModel.get(this.expertId, true);
    this._onExpertUpdate(expert);
  }

  /**
   * @method _modalSave
   * @description modal save event
   */
  async _modalSave(e) {
    e.preventDefault();

    this.dispatchEvent(new CustomEvent("loading", {}));

    this.showModal = false;
    let action = e.currentTarget.title.trim() === 'Hide Work' ? 'hide' : 'reject';
    this.modifiedWorks = true;

    if( action === 'hide' ) {
      try {
        let res = await this.ExpertModel.updateCitationVisibility(this.expertId, this.citationId, false);
        this.dispatchEvent(new CustomEvent("loaded", {}));

        if( window.gtag ) {
          gtag('event', 'citation_is_visible', {
            'description': 'citation ' + this.citationId + ' hidden for expert ' + this.expertId,
            'relationshipId': this.citationId,
            'expertId': this.expertId,
            'fatal': false
          });
        }
      } catch (error) {
        this.dispatchEvent(new CustomEvent("loaded", {}));

        let citationTitle = this.citations.filter(c => c.relatedBy?.['@id'] === this.citationId)?.[0]?.title || '';
        let modelContent = `<p>Changes to the visibility of (${citationTitle}) could not be done through Aggie Experts right now. Please, try again later, or make changes directly in the <a href="https://oapolicy.universityofcalifornia.edu/listobjects.html?as=1&am=false&cid=1&tids=5&ipr=true">UC Publication Management System.</a></p><p>For more help, see <a href="/faq#visible-publication">troubleshooting tips.</a></p>`;

        this.modalTitle = 'Error: Update Failed';
        this.modalContent = modelContent;
        this.showModal = true;
        this.hideCancel = true;
        this.hideSave = true;
        this.hideOK = false;
        this.hideOaPolicyLink = true;
        this.errorMode = true;

        if( window.gtag ) {
          gtag('event', 'citation_is_visible', {
            'description': 'attempted to hide citation ' + this.citationId + ' for expert ' + this.expertId + ' but failed',
            'relationshipId': this.citationId,
            'expertId': this.expertId,
            'fatal': false
          });
        }
      }

      // update graph/display data
      let citation = this.citationsDisplayed.filter(c => c.relatedBy?.['@id'] === this.citationId)[0];
      if( citation ) citation.relatedBy['is-visible'] = false;
      citation = this.citations.filter(c => c.relatedBy?.['@id'] === this.citationId)[0];
      if( citation ) citation.relatedBy['is-visible'] = false;
      citation = (this.expert['@graph'] || []).filter(c => c.relatedBy?.['@id'] === this.citationId)[0];
      if( citation ) citation.relatedBy['is-visible'] = false;
      this.hiddenCitations = this.citations.filter(c => !c.relatedBy?.['is-visible']).length;

      this.requestUpdate();
    } else if ( action === 'reject' ) {
      try {
        let res = await this.ExpertModel.rejectCitation(this.expertId, this.citationId);
        this.dispatchEvent(new CustomEvent("loaded", {}));

        if( window.gtag ) {
          gtag('event', 'citation_reject', {
            'description': 'citation ' + this.citationId + ' rejected for expert ' + this.expertId,
            'fatal': false
          });
        }
      } catch (error) {
        this.dispatchEvent(new CustomEvent("loaded", {}));

        let citationTitle = this.citations.filter(c => c.relatedBy?.['@id'] === this.citationId)?.[0]?.title || '';
        let modelContent = `<p>Rejecting (${citationTitle}) could not be done through Aggie Experts right now. Please, try again later, or make changes directly in the <a href="https://oapolicy.universityofcalifornia.edu/">UC Publication Management System.</a></p><p>For more help, see <a href="/faq#reject-publication">troubleshooting tips.</a></p>`;

        this.modalTitle = 'Error: Update Failed';
        this.modalContent = modelContent;
        this.showModal = true;
        this.hideCancel = true;
        this.hideSave = true;
        this.hideOK = false;
        this.hideOaPolicyLink = true;
        this.errorMode = true;

        if( window.gtag ) {
          gtag('event', 'citation_reject', {
            'description': 'attempted to reject citation ' + this.citationId + ' for expert ' + this.expertId + ' but failed',
            'fatal': false
          });
        }
      }

      // remove citation from graph/display data
      // also if total citations > 25, need to reorganize
      this.citations = this.citations.filter(c => c.relatedBy?.['@id'] !== this.citationId);
      this.citationsDisplayed = this.citationsDisplayed.filter(c => c.relatedBy?.['@id'] !== this.citationId);
      this.expert['@graph'] = this.expert['@graph'].filter(c => c.relatedBy?.['@id'] !== this.citationId);
      this._onPaginationChange({ detail: { page: this.currentPage } });

      this.hiddenCitations = this.citations.filter(c => !c.relatedBy?.['is-visible']).length;
      this.totalCitations = this.citations.length;
      this.paginationTotal = Math.ceil(this.citations.length / this.resultsPerPage);

      this.requestUpdate();
    }

    // let expert = await this.ExpertModel.get(this.expertId, true);
    // this._onExpertUpdate(expert);
  }

  /**
   * @method _rejectWork
   * @description show modal with link to reject work
   */
  _rejectWork(e) {
    this.citationId = e.currentTarget.dataset.id;

    this.modalTitle = 'Reject Work';
    this.modalContent = `<p>This record will be <strong>permanently removed</strong> from your Aggie Experts profile. To reclaim this item, you must do so via the UC Publication Management System.</p><p>Are you sure you want to reject this work?</p>`;
    this.showModal = true;
    this.hideCancel = false;
    this.hideSave = false;
    this.hideOK = true;
    this.hideOaPolicyLink = true;
    this.errorMode = false;
  }

  /**
   * @method _addNewWorkClicked
   * @description show modal with link to add work
   */
  _addNewWorkClicked(e) {
    e.preventDefault();
    // this.AppStateModel.setLocation('/works-add/'+this.expertId);
    this.modalTitle = 'Add New Work';
    this.modalContent = `<p>New works are added, claimed or rejected via the <strong>UC Publication Management System.</strong></p><p>You will be redirected to this system.</p>`;
    this.showModal = true;
    this.hideCancel = false;
    this.hideSave = true;
    this.hideOK = true;
    this.hideOaPolicyLink = false;
    this.errorMode = false;
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

    this.AppStateModel.store.data.modifiedWorks = true;
    this.AppStateModel.setLocation('/'+this.expertId);
  }

}

customElements.define('app-expert-works-list-edit', AppExpertWorksListEdit);
