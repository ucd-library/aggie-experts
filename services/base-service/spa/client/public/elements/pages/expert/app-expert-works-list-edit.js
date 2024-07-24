import { LitElement } from 'lit';
import {render} from "./app-expert-works-list-edit.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";
import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";
import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import "@ucd-lib/theme-elements/brand/ucd-theme-collapse/ucd-theme-collapse.js";

import '../../utils/app-icons.js';
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
      manageWorksLabel : { type : String },
      worksWithErrors : { type : Array },
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
    this.manageWorksLabel = 'Manage My Works';
    this.worksWithErrors = [];

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

    // parse /size/page/ from url, or append if trying to access /works-edit
    let page = e.location.pathname.split('/works-edit/')?.[1];
    if( page ) {
      let parts = page.split('/');
      this.currentPage = Number(parts?.[1] || 1);
      this.resultsPerPage = Number(parts?.[0] || 25);
    } else {
      this.AppStateModel.setLocation(this.AppStateModel.location.fullpath+'/'+this.resultsPerPage+'/'+this.currentPage+'/');
    }

    window.scrollTo(0, 0);

    this.modifiedWorks = false;
    let expertId = e.location.path[0]+'/'+e.location.path[1]; // e.location.pathname.replace('/works-edit', '');
    if( expertId.substr(0,1) === '/' ) expertId = expertId.substr(1);

    let canEdit = (APP_CONFIG.user?.expertId === expertId || utils.getCookie('editingExpertId') === expertId);

    if( !expertId || !canEdit ) this.dispatchEvent(new CustomEvent("show-404", {}));

    try {
      let expert = await this.ExpertModel.get(
        expertId,
        `/works-edit?page=${this.currentPage}&size=${this.resultsPerPage}`, // subpage
        utils.getExpertApiOptions({
          includeGrants : false,
          worksPage : this.currentPage,
          worksSize : this.resultsPerPage,
          includeHidden : true,
          includeWorksMisformatted : true
        })
      );
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
    if( e?.state !== 'loaded' ) return;
    if( this.AppStateModel.location.page !== 'works-edit' ) return;
    if( e.id.includes('/works-download') ) return;

    this.expertId = e.id.split('/works-edit')[0];
    this.expert = JSON.parse(JSON.stringify(e.payload));
    this.isVisible = this.expert['is-visible'];

    let graphRoot = (this.expert['@graph'] || []).filter(item => item['@id'] === this.expertId)[0];
    this.expertName = graphRoot.hasName?.given + (graphRoot.hasName?.middle ? ' ' + graphRoot.hasName.middle : '') + ' ' + graphRoot.hasName?.family;

    this.hiddenCitations = this.expert?.totals?.hiddenWorks || 0;
    this.totalCitations = (this.expert?.totals?.works || 0);

    if( this.hiddenCitations === 0 ) {
      this.manageWorksLabel = `Manage My Works (${this.totalCitations})`;
    } else {
      this.manageWorksLabel = `Manage My Works (${this.totalCitations} Public, ${this.hiddenCitations} Hidden)`;
    }

    this.worksWithErrors = this.expert.invalidWorks || [];
    this.worksWithErrors.sort((a, b) => {
      // sort issued descending
      let issuedA = a.issued?.split('-')?.[0] === 'Date Unknown' ? -Infinity : Number(a.issued?.split('-')?.[0]);
      let issuedB = b.issued?.split('-')?.[0] === 'Date Unknown' ? -Infinity : Number(b.issued?.split('-')?.[0]);

      if (issuedA !== issuedB) {
        return issuedB - issuedA;
      }

      return a.title.localeCompare(b.title);
    })

    // only expert graph record, no works for this pagination of results
    if( this.expert['@graph'].length === 1 ) {
      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
      return;
    }

    await this._loadCitations();
  }

  /**
   * @method _loadCitations
   * @description load citations for expert async
   *
   * @param {Boolean} all load all citations, not just first 25, used for downloading all citations
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

    let citationResults = await Citation.generateCitations(citations);
    citationResults = citationResults.map(c => c.value || c.reason?.data);

    // also remove issued date from citations if not first displayed on page from that year
    let lastPrintedYear;
    citationResults.forEach((cite, i) => {
      if( !Array.isArray(cite.issued) ) cite.issued = cite.issued.split('-');
      let newIssueDate = cite.issued?.[0];
      if( i > 0 && ( newIssueDate === citationResults[i-1].issued?.[0] || lastPrintedYear === newIssueDate ) && i % this.resultsPerPage !== 0 ) {
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

    this.paginationTotal = Math.ceil(this.totalCitations / this.resultsPerPage);

    if( all ) return citationResults;

    this.citationsDisplayed = citationResults;
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
    if( maxIndex > this.totalCitations ) maxIndex = this.totalCitations;

    this.currentPage = e.detail.page;
    this.AppStateModel.setLocation('/'+this.expertId+'/works-edit/'+this.resultsPerPage+'/'+this.currentPage+'/');


    // await this._loadCitations();
    let expert = await this.ExpertModel.get(
      this.expertId,
      `/works-edit?page=${this.currentPage}&size=${this.resultsPerPage}`, // subpage
      utils.getExpertApiOptions({
        includeGrants : false,
        worksPage : this.currentPage,
        worksSize : this.resultsPerPage,
        includeHidden : true,
        includeWorksMisformatted : true
      })
    );
    await this._onExpertUpdate(expert);

    requestAnimationFrame(() => {
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
    });

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
    let downloads = allCitations.filter(c => this.downloads.includes(c['@id']));

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

    let expert = await this.ExpertModel.get(
      this.expertId,
      `/works-edit?page=${this.currentPage}&size=${this.resultsPerPage}`, // subpage
      utils.getExpertApiOptions({
        includeGrants : false,
        worksPage : this.currentPage,
        worksSize : this.resultsPerPage,
        includeHidden : true,
        includeWorksMisformatted : true
      }),
      true // clear cache
    );
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
            'relationshipId': this.citationId,
            'expertId': this.expertId,
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
            'relationshipId': this.citationId,
            'expertId': this.expertId,
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

      // TODO the counts will be broken, however calling the api again to get the current data will be cached, so would that work even if we try to update the totals here?

      // this.hiddenCitations = this.citations.filter(c => !c.relatedBy?.['is-visible']).length;
      // this.totalCitations = this.citations.length;
      this.paginationTotal = Math.ceil(this.totalCitations / this.resultsPerPage);

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
