import { LitElement } from 'lit';
import {render} from "./app-expert-grants-list-edit.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";
import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";
import '../../components/modal-overlay.js';

import { generateCitations } from '../../utils/citation.js';

export default class AppExpertGrantsListEdit extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      expertId : { type : String },
      expert : { type : Object },
      expertName : { type : String },
      grants : { type : Array },
      grantsActiveDisplayed : { type : Array },
      grantsCompletedDisplayed : { type : Array },
      paginationTotal : { type : Number },
      currentPage : { type : Number },
      allSelected : { type : Boolean },
      showModal : { type : Boolean },
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
    this.grants = [];
    this.grantsActiveDisplayed = [];
    this.grantsCompletedDisplayed = [];
    this.paginationTotal = 1;
    this.currentPage = 1;
    this.resultsPerPage = 25;
    this.allSelected = false;
    this.showModal = false;
    this.downloads = [];

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
    if( e.location.page !== 'grants-edit' ) {
      this._reset();
      return;
    }

    window.scrollTo(0, 0);

    let expertId = e.location.pathname.replace('/grants-edit/', '');
    if( !expertId ) this.dispatchEvent(new CustomEvent("show-404", {}));
    if( expertId === this.expertId ) return;

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
    if( this.AppStateModel.location.page !== 'grants-edit' ) return;

    if( e.id === this.expertId ) return;

    this.expertId = e.id;
    this.expert = JSON.parse(JSON.stringify(e.payload));

    let graphRoot = this.expert['@graph'].filter(item => item['@id'] === this.expertId)[0];
    this.expertName = graphRoot.name;

    await this._loadCitations();


    // TODO parse grant data
    let fakeGrants = [{
      "id" : "ark:/87287/d7gt0q/grant/1",
      "category" : "grant",
      "type" : "c-davis",
      "url" : "",
      "institution-reference" : "ark:/87287/d7gt0q/grant/1",
      "title" : "WORKER HEALTH & SAFETY SPECIALIZED DATA AND LITERATURE RESEARCH",
      "funding-type" : "Default",
      "start-date" : "2014-08-10",
      "end-date" : "2027-04-11",
      "c-ucop-sponsor" : "http://rems.ucop.edu/sponsor/6320",
      "funder-name" : "CALIFORNIA DEPARTMENT OF PESTICIDE REGULATION",
      "funder-reference" : "04-0061C",
      "amount-value" : "22600",
      "amount-currency-code" : "USD",
      "visible" : "TRUE"
    },
    {
      "id" : "ark:/87287/d7gt0q/grant/2",
      "category" : "grant",
      "type" : "c-davis",
      "url" : "",
      "institution-reference" : "ark:/87287/d7gt0q/grant/1",
      "title" : "NUM DOS NUM DOS",
      "funding-type" : "Default",
      "start-date" : "2014-12-10",
      "end-date" : "2020-02-28",
      "c-ucop-sponsor" : "http://rems.ucop.edu/sponsor/6320",
      "funder-name" : "CALIFORNIA DEPARTMENT OF AG REGULATION",
      "funder-reference" : "24-1111F",
      "amount-value" : "424242",
      "amount-currency-code" : "USD",
      "visible" : "TRUE"
    }];

    this.grants = fakeGrants;
    this.grantsActiveDisplayed = fakeGrants.slice(0,1); // this.grantsPerPage);
    this.grantsCompletedDisplayed = fakeGrants.slice(1,2); // this.grantsPerPage);
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

    let startIndex = (this.currentPage - 1) * this.resultsPerPage || 0;
    let citationResults = all ? await generateCitations(this.citations) : await generateCitations(this.citations.slice(startIndex, startIndex + this.resultsPerPage));

    this.citationsDisplayed = citationResults.map(c => c.value);

    // also remove issued date from citations if not first displayed on page from that year
    let lastPrintedYear;
    this.citationsDisplayed.forEach((cite, i) => {
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

    console.log('this.citations', this.citations);
    console.log('this.citationsDisplayed', this.citationsDisplayed);

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

    let text = downloads.map(c => c.ris).join('\n');
    let blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    console.log('url', url)

    console.log('downloads', downloads);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'grants.ris');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * @method _hideGrant
   * @description show modal with link to hide grant
   */
  _hideGrant(e) {
    this.modalTitle = 'Hide Grant';
    this.modalContent = `<p>This record will be <strong>hidden from your profile</strong> and marked as "Internal" in the UC Publication Management System.</p><p>Are you sure you want to hide this work?</p>`;
    this.showModal = true;
  }

  /**
   * @method _rejectGrant
   * @description show modal with link to reject grant
   */
  _rejectGrant(e) {
    this.modalTitle = 'Reject Grant';
    this.modalContent = `<p>This record will be <strong>permanently removed</strong> from being associated with you in both Aggie Experts and the UC Publication Management System.</p><p>Are you sure you want to reject this work?</p>`;
    this.showModal = true;
  }

  /**
   * @method _returnToProfile
   * @description return to /expert/<id> page
   *
   * @return {Object} e
   */
  _returnToProfile(e) {
    e.preventDefault();
    this.AppStateModel.setLocation('/'+this.expertId);
  }

}

customElements.define('app-expert-grants-list-edit', AppExpertGrantsListEdit);
