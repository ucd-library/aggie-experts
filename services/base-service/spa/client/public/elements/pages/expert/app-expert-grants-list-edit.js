import { LitElement } from 'lit';
import {render} from "./app-expert-grants-list-edit.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";
import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";
import '../../components/modal-overlay.js';

import utils from '../../../lib/utils';

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

    let grants = JSON.parse(JSON.stringify(this.expert['@graph'].filter(g => g['@type'].includes('Grant'))));
    this.grants = utils.parseGrants(grants);

    this.grantsActiveDisplayed = (this.grants.filter(g => !g.completed) || []).slice(0, this.resultsPerPage);
    this.grantsCompletedDisplayed = (this.grants.filter(g => g.completed) || []).slice(0, this.resultsPerPage - this.grantsActiveDisplayed.length);

    this.paginationTotal = Math.ceil(this.grants.length / this.resultsPerPage);
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
    if( maxIndex > this.grants.length ) maxIndex = this.grants.length;

    this.currentPage = e.detail.page;

    this.grantsActiveDisplayed = (this.grants.filter(g => !g.completed) || []); //.slice(e.detail.startIndex, maxIndex);
    this.grantsCompletedDisplayed = (this.grants.filter(g => g.completed) || []); //.slice(e.detail.startIndex - this.grantsActiveDisplayed.length, maxIndex - this.grantsActiveDisplayed.length);

    let grantsActiveCount = this.grantsActiveDisplayed.length;
    let grantsCompletedCount = this.grantsCompletedDisplayed.length;

    // if first page, load grantsActive under this.resultsPerPage and remaining from grantsCompleted
    // else if second page+, remove grants from active and completed in order
    if( this.currentPage === 1 ) {
      this.grantsActiveDisplayed = this.grantsActiveDisplayed.slice(0, this.resultsPerPage);
      this.grantsCompletedDisplayed = this.grantsCompletedDisplayed.slice(0, this.resultsPerPage - this.grantsActiveDisplayed.length);
    } else {
      let currentIndex = this.resultsPerPage * (this.currentPage - 1);
      this.grantsActiveDisplayed = this.grantsActiveDisplayed.slice(currentIndex, this.resultsPerPage);

      // TODO broken..
      // what if active grants are 50?
      // what if 0 active grants and 50 completed grants?
      this.grantsCompletedDisplayed = this.grantsCompletedDisplayed.slice(currentIndex - grantsActiveCount, currentIndex - grantsActiveCount + this.resultsPerPage);
    }

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

    // The download csv should contain
    //   Title : dl.name
    //   Funding Agency : dl.awardedBy
    //   Grant id : dl.sponsorAwardId
    //   Start date : dl.dateTimeInterval.start.dateTime
    //   End date : dl.dateTimeInterval.end.dateTime
    //   Type of Grant : dl.role
    //   List of contributors (role) {separate contributors by ";"}

    /*
    {
    "assignedBy": {
        "@type": "FundingOrganization",
        "name": "CALIFORNIA DEPARTMENT OF WATER RESOURCES",
        "@id": "ark:/87287/d7mh2m/grant/4344862#unknown-funder"
    },
    "dateTimeInterval": {
        "@type": "DateTimeInterval",
        "start": {
            "dateTime": "2014-07-30",
            "@type": "DateTimeValue",
            "@id": "ark:/87287/d7mh2m/grant/4344862#start-date",
            "dateTimePrecision": "vivo:yearMonthDayPrecision"
        },
        "end": {
            "dateTime": "2017-07-29",
            "@type": "DateTimeValue",
            "@id": "ark:/87287/d7mh2m/grant/4344862#end-date",
            "dateTimePrecision": "vivo:yearMonthDayPrecision"
        },
        "@id": "ark:/87287/d7mh2m/grant/4344862#duration"
    },
    "@type": [
        "Grant",
        "vivo:Grant"
    ],
    "totalAwardAmount": "181353",
    "name": "SIMETAW and Cal-SIMETAW Upgrade",
    "@id": "ark:/87287/d7mh2m/grant/4344862",
    "relatedBy": {
        "relates": [
            "expert/66356b7eec24c51f01e757af2b27ebb8",
            "ark:/87287/d7mh2m/grant/4344862"
        ],
        "@type": "GrantRole",
        "@id": "ark:/87287/d7mh2m/relationship/13340713",
        "is-visible": true
    },
    "sponsorAwardId": "4600010450",
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": {
        "name": "Research",
        "@id": "ucdlib:Grant_Research"
    },
    "start": 2014,
    "end": 2017,
    "completed": true,
    "role": "Research",
    "awardedBy": "CALIFORNIA DEPARTMENT OF WATER RESOURCES"
    }
    */

    let downloads = this.grants.filter(g => this.downloads.includes(g['@id']));

    let text = downloads.map(c => c.ris).join('\n');
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
   * @method _hideGrant
   * @description show modal with link to hide grant
   */
  _hideGrant(e) {
    this.modalTitle = 'Hide Grant';
    this.modalContent = `<p>This record will be <strong>hidden from your profile</strong> and marked as "Internal" in the UC Publication Management System.</p><p>Are you sure you want to hide this work?</p>`;
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
