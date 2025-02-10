import { LitElement } from 'lit';
import {render} from "./app-expert-grants-list-edit.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";
import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";
import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import "@ucd-lib/theme-elements/brand/ucd-theme-collapse/ucd-theme-collapse.js";

import '../../utils/app-icons.js';
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
      totalGrants : { type : Number },
      hiddenGrants : { type : Number },
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
      manageGrantsLabel : { type : String },
      grantsWithErrors : { type : Array }
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
    this.totalGrants = 0;
    this.hiddenGrants = 0;
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
    this.manageGrantsLabel = 'Manage My Grants';
    this.grantsWithErrors = [];

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

    // parse /page/size from url, or append if trying to access /works
    let page = e.location.pathname.split('/grants-edit/')?.[1];
    if( page ) {
      let parts = page.split('/');
      this.currentPage = Number(parts?.[0] || 1);
      this.resultsPerPage = Number(parts?.[1] || 25);
    }

    window.scrollTo(0, 0);

    this.modifiedGrants = false;
    let expertId = e.location.path[0]+'/'+e.location.path[1]; // e.location.pathname.replace('/grants-edit', '');
    if( expertId.substr(0,1) === '/' ) expertId = expertId.substr(1);
    let canEdit = (APP_CONFIG.user?.expertId === expertId || utils.getCookie('editingExpertId') === expertId);

    if( !expertId || !canEdit ) this.dispatchEvent(new CustomEvent("show-404", {}));
    if( expertId === this.expertId || !canEdit ) return;

    try {
      let expert = await this.ExpertModel.get(
        expertId,
        `/grants-edit?page=${this.currentPage}&size=${this.resultsPerPage}`, // subpage
        utils.getExpertApiOptions({
          includeWorks : false,
          grantsPage : this.currentPage,
          grantsSize : this.resultsPerPage,
          includeHidden : true,
          includeGrantsMisformatted : true
        }),
        this.currentPage === 1 // clear cache on first page
      );
      if( expert.state === 'error' || (!this.isAdmin && !this.isVisible) ) throw new Error();

      this._onExpertUpdate(expert);
    } catch (error) {
      this.logger.warn('expert ' + expertId + ' not found, throwing 404');

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
    if( e.id.includes('/grants-download') ) return;


    this.expertId = e.expertId;
    this.expert = JSON.parse(JSON.stringify(e.payload));
    this.isVisible = this.expert['is-visible'];

    let graphRoot = (this.expert['@graph'] || []).filter(item => item['@id'] === this.expertId)[0];
    this.expertName = graphRoot.hasName?.given + (graphRoot.hasName?.middle ? ' ' + graphRoot.hasName.middle : '') + ' ' + graphRoot.hasName?.family;

    let grants = JSON.parse(JSON.stringify((this.expert['@graph'] || []).filter(g => g['@type'].includes('Grant'))));
    // this.totalGrants = grants.length;

    this.grants = utils.parseGrants(this.expertId, grants, false); // don't filter hidden grants
    // this.hiddenGrants = this.grants.filter(g => !g.isVisible).length;

    this.grantsActiveDisplayed = (this.grants.filter(g => !g.completed) || []).slice(0, this.resultsPerPage);
    this.grantsCompletedDisplayed = (this.grants.filter(g => g.completed) || []).slice(0, this.resultsPerPage - this.grantsActiveDisplayed.length);

    this.hiddenGrants = this.expert?.totals?.hiddenGrants || 0;
    this.totalGrants = (this.expert?.totals?.grants || 0);

    this._updateManageGrantsLabel();

    this.grantsWithErrors = this.expert.invalidGrants || [];
    if( this.grantsWithErrors.length ) this.logger.error('grants with errors', { expertId : this.expertId, grantsWithErrors : this.grantsWithErrors });

    this.grantsWithErrors.sort((a, b) => {
      // sort end date descending
      let endDateA = a.dateTimeInterval?.end?.dateTime?.split('-')?.[0] === 'Date Unknown' ? -Infinity : Number(a.dateTimeInterval?.end?.dateTime?.split('-')?.[0]);
      let endDateB = b.dateTimeInterval?.end?.dateTime?.split('-')?.[0] === 'Date Unknown' ? -Infinity : Number(b.dateTimeInterval?.end?.dateTime?.split('-')?.[0]);

      if (endDateA !== endDateB) {
        return endDateB - endDateA;
      }

      return 0;
    })

    // only expert graph record, no works for this pagination of results
    if( this.expert['@graph'].length === 1 ) {
      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
      return;
    }

    this.paginationTotal = Math.ceil(this.totalGrants / this.resultsPerPage);
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
    if( maxIndex > this.totalGrants ) maxIndex = this.totalGrants;

    this.currentPage = e.detail.page;

    let path = '/'+this.expertId+'/grants-edit';
    if( this.currentPage > 1 || this.resultsPerPage !== 25 ) path += '/'+this.currentPage;
    if( this.resultsPerPage !== 25 ) path += '/'+this.resultsPerPage;
    this.AppStateModel.setLocation(path);

    let expert = await this.ExpertModel.get(
      this.expertId,
      `/grants-edit?page=${this.currentPage}&size=${this.resultsPerPage}`, // subpage
      utils.getExpertApiOptions({
        includeWorks : false,
        grantsPage : this.currentPage,
        grantsSize : this.resultsPerPage,
        includeHidden : true,
        includeGrantsMisformatted : true
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
      '/grants-download', // subpage
      utils.getExpertApiOptions({
        includeWorks : false,
        grantsSize : 10000,
        includeHidden : false
      })
    );

    let allGrants = JSON.parse(JSON.stringify((res?.payload?.['@graph'] || []).filter(g => g['@type'].includes('Grant'))));
    allGrants = utils.parseGrants(this.expertId, allGrants);

    let downloads = allGrants.filter(g => this.downloads.includes(g['@id']));
    let body = [];
    downloads.forEach(grant => {
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
    this.logger.info('grants downloaded for expert', { expertId : this.expertId, csv : body });
  }

  /**
   * @method _hideGrant
   * @description show modal with link to hide grant
   */
  _hideGrant(e) {
    this.grantId = e.currentTarget.dataset.id;

    this.modalTitle = 'Hide Grant';
    this.modalContent = `<p>This record will be <strong>hidden from your profile</strong> and marked as "Internal" in the UC Publication Management System.</p><p>Are you sure you want to hide this grant?</p>`;
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
  async _showGrant(e) {
    this.grantId = e.currentTarget.dataset.id;
    this.dispatchEvent(new CustomEvent("loading", {}));
    let updated = true;
    try {
      let res = await this.ExpertModel.updateGrantVisibility(this.expertId, this.grantId, true);
      this.dispatchEvent(new CustomEvent("loaded", {}));

      if( window.gtag ) {
        gtag('event', 'grant_is_visible', {
          'description': 'grant ' + this.grantId + ' shown for expert ' + this.expertId,
          'relationshipId': this.grantId,
          'expertId': this.expertId,
          'fatal': false
        });
      }
      this.logger.info('setting grant to be visible', { grantId : this.grantId, expertId : this.expertId });
    } catch (error) {
      this.dispatchEvent(new CustomEvent("loaded", {}));

      updated = false;
      let grantTitle = this.grants.filter(g => g.relationshipId === this.grantId)?.[0]?.name || '';
      let modelContent = `
        <p>
          <strong>${grantTitle}</strong> could not be updated. Please try again later or make your changes directly in the
          <a href="https://oapolicy.universityofcalifornia.edu/listobjects.html?as=1&am=false&cid=2&oa=&tol=&tids=&f=&rp=&vs=&nad=&rs=&efa=&sid=&y=&ipr=true&jda=&iqf=&id=&wt=" target="_blank">UC Publication Management System (opens in new tab).</a>
        </p>
        <p>For more help, see <a href="/faq#visible-publication">troubleshooting tips.</a></p>
      `;

      this.modalTitle = 'Error: Update Failed';
      this.modalContent = modelContent;
      this.showModal = true;
      this.hideCancel = true;
      this.hideSave = true;
      this.hideOK = false;
      this.hideOaPolicyLink = true;
      this.errorMode = true;

      if( window.gtag ) {
        gtag('event', 'grant_is_visible', {
          'description': 'attempted to show grant ' + this.grantId + ' for expert ' + this.expertId + ' but failed',
          'relationshipId': this.grantId,
          'expertId': this.expertId,
          'fatal': false
        });
      }
      this.logger.error('failed to set grant to be visible', { grantId : this.grantId, expertId : this.expertId });
    }

    this.modifiedGrants = true;

    // update graph/display data
    let grant = this.grants.filter(g => g.relationshipId === this.grantId)[0];
    if( grant ) grant.isVisible = true;
    grant = this.grantsActiveDisplayed.filter(g => g.relationshipId === this.grantId)[0];
    if( grant ) grant.isVisible = true;
    grant = this.grantsCompletedDisplayed.filter(g => g.relationshipId === this.grantId)[0];
    if( grant ) grant.isVisible = true;

    if( updated && this.hiddenGrants >= 0 ) this.hiddenGrants -= 1;
    if( updated ) this.modifiedGrants = true;
    this._updateManageGrantsLabel();

    this.requestUpdate();
  }

  /**
   * @method _modalSave
   * @description modal save event
   */
  async _modalSave(e) {
    e.preventDefault();

    this.dispatchEvent(new CustomEvent("loading", {}));

    this.showModal = false;
    let action = e.currentTarget.title.trim() === 'Hide Grant' ? 'hide' : '';
    let updated = true;

    if( action === 'hide' ) {
      try {
        let res = await this.ExpertModel.updateGrantVisibility(this.expertId, this.grantId, false);
        this.dispatchEvent(new CustomEvent("loaded", {}));

        if( window.gtag ) {
          gtag('event', 'grant_is_visible', {
            'description': 'grant ' + this.grantId + ' hidden for expert ' + this.expertId,
            'relationshipId': this.grantId,
            'expertId': this.expertId,
            'fatal': false
          });
        }
        this.logger.info('setting grant to be hidden', { grantId : this.grantId, expertId : this.expertId });
      } catch (error) {
        this.dispatchEvent(new CustomEvent("loaded", {}));
        updated = false;

        let grantTitle = this.grants.filter(g => g.relationshipId === this.grantId)?.[0]?.name || '';
        let modelContent = `
          <p>
            <strong>${grantTitle}</strong> could not be updated. Please try again later or make your changes directly in the
            <a href="https://oapolicy.universityofcalifornia.edu/listobjects.html?as=1&am=false&cid=2&oa=&tol=&tids=&f=&rp=&vs=&nad=&rs=&efa=&sid=&y=&ipr=true&jda=&iqf=&id=&wt=" target="_blank">UC Publication Management System (opens in new tab).</a>
          </p>
          <p>For more help, see <a href="/faq#visible-publication">troubleshooting tips.</a></p>
        `;

        this.modalTitle = 'Error: Update Failed';
        this.modalContent = modelContent;
        this.showModal = true;
        this.hideCancel = true;
        this.hideSave = true;
        this.hideOK = false;
        this.hideOaPolicyLink = true;
        this.errorMode = true;

        if( window.gtag ) {
          gtag('event', 'grant_is_visible', {
            'description': 'attempted to hide grant ' + this.grantId + ' for expert ' + this.expertId + ' but failed',
            'relationshipId': this.grantId,
            'expertId': this.expertId,
            'fatal': false
          });
        }
        this.logger.error('failed to set grant to be hidden', { grantId : this.grantId, expertId : this.expertId });
      }

      // update graph/display data
      let grant = this.grants.filter(g => g.relationshipId === this.grantId)[0];
      if( grant ) grant.isVisible = false;
      grant = this.grantsActiveDisplayed.filter(g => g.relationshipId === this.grantId)[0];
      if( grant ) grant.isVisible = false;
      grant = this.grantsCompletedDisplayed.filter(g => g.relationshipId === this.grantId)[0];
      if( grant ) grant.isVisible = false;

      if( updated ) this.hiddenGrants += 1;
      if( updated ) this.modifiedGrants = true;
      this._updateManageGrantsLabel();

      this.requestUpdate();
    }
  }

  _updateManageGrantsLabel() {
    if( this.hiddenGrants === 0 ) {
      this.manageGrantsLabel = `Manage My Grants (${this.totalGrants})`;
    } else {
      this.manageGrantsLabel = `Manage My Grants (${this.totalGrants - this.hiddenGrants} Public, ${this.hiddenGrants} Hidden)`;
    }
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
    let grants = JSON.parse(JSON.stringify((this.expert['@graph'] || []).filter(g => g['@type'].includes('Grant'))));
    this.grants = utils.parseGrants(this.expertId, grants);
    this.grantsActiveDisplayed = (this.grants.filter(g => !g.completed) || []).slice(0, this.resultsPerPage);
    this.grantsCompletedDisplayed = (this.grants.filter(g => g.completed) || []).slice(0, this.resultsPerPage - this.grantsActiveDisplayed.length);

    // this.AppStateModel.store.data.modifiedGrants = this.modifiedGrants;
    this.AppStateModel.setLocation('/'+this.expertId);
    this.AppStateModel.set({ modifiedGrants : this.modifiedGrants });
  }

}

customElements.define('app-expert-grants-list-edit', AppExpertGrantsListEdit);
