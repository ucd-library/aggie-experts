import { LitElement } from 'lit';
import {render} from "./app-admin.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import '@ucd-lib/theme-elements/brand/ucd-theme-list-accordion/ucd-theme-list-accordion.js'

import { getYearWeek, getTodaysDate, parseYearWeek } from '/opt/commons/lib/year-week.js';

import '../../components/modal-overlay.js';

import indexedDb from '../../../lib/utils/indexedDb.js';

export default class AppAdmin extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      isLoggedIn : { type : Boolean },
      availableElasticIndexes : { type : Array },
      uniqueElasticIndexes : { type : Array },
      currentElasticIndex : { type : String },
      isAdmin : { type : Boolean },
      showModal : { type : Boolean },
      modalTitle : { type : String },
      modalSaveText : { type : String },
      modalContent : { type : String },
      toPublishIndex : { type : String },
      toDeleteIndex : { type : String },
      manageDataAction : { type : String },
      dataVersionFailed : { type : Boolean },
      dataVersionPending : { type : Boolean },
      dataVersionSuccess : { type : Boolean },
      publicIndexName : { type : String },
      publicIndexDateRange : { type : String },
      latestIndexName : { type : String },
      latestIndexDateRange : { type : String },
      dataMismatch : { type : Boolean },
      mismatchedIndexes : { type : Array },
      currentPreviewIndex : { type : String }
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'SchemaModel', 'BrowseByModel', 'ExpertModel', 'GrantModel', 'WorkModel', 'SearchModel');

    this.isLoggedIn = APP_CONFIG.user?.preferred_username ? true : false;
    this.availableElasticIndexes = [];
    this.uniqueElasticIndexes = [];
    this.currentElasticIndex = '';
    this.isAdmin = (APP_CONFIG.user?.roles || []).includes('admin') || false;

    this.showModal = false;
    this.modalTitle = "Publish to Public Site";
    this.modalSaveText = "Publish";
    this.modalContent = "<p>Public site will switch from <> to <>.</p>";
    this.toPublishIndex = '';
    this.toDeleteIndex = '';
    this.manageDataAction = 'preview';
    this.dataVersionFailed = false;
    this.dataVersionPending = false;
    this.dataVersionSuccess = false;

    this.publicIndexName = '';
    this.publicIndexDateRange = '';
    this.latestIndexName = '';
    this.latestIndexDateRange = '';

    this.dataMismatch = false;
    this.mismatchedIndexes = [];

    this.currentPreviewIndex = '';

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
    if( e.location.page !== 'admin' ) return;
    
    if( !(APP_CONFIG.user?.roles || []).includes('admin') ) {
      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
      return;
    } 

    if( this.isAdmin ) {
      await this._getAvailableElasticIndexes();
      this._updateVersionStats();
    }
    this._updateSlimSelectStyles();
  }

  async _getAvailableElasticIndexes() {
    if( !this.isAdmin ) return;
    
    let res = await this.SchemaModel.getIndexes();

    let indexes = [];
    for( let indexName in (res.body || {}) ) {
      let indexDisplayName = indexName.replace(/^(experts|grants|works)-/, ''); // 2026-09-dc-admin-page
      let indexYYYYMM = indexDisplayName.split('-')?.[0] + '-' + indexDisplayName.split('-')?.[1]; // 2026-09
      let aliasName = (res.body || {})[indexName]?.aliases?.[0] || ''; // experts-public, experts-latest, etc

      // (Latest, Previewing, Public)
      let displayLabels = [];
      let current = APP_CONFIG.esAliases.current;
      let stage = APP_CONFIG.esAliases.stage;
      if( aliasName?.includes(current) ) displayLabels.push(current.charAt(0).toUpperCase() + current.slice(1));
      if( aliasName?.includes(stage) ) displayLabels.push(stage.charAt(0).toUpperCase() + stage.slice(1));

  
      // TODO check if previewing index


      // subtext of dropdown, ie Feb 2 - 9, or Feb 28 - Mar 3
      let yearWeek = parseYearWeek(indexYYYYMM, { allValues : true });
      let dateRange = this._formatWeekRange(
        yearWeek.weekStart,
        yearWeek.weekEnd
      );
      let dateRangeFull = this._formatWeekRange(
        yearWeek.weekStart,
        yearWeek.weekEnd,
        true
      );

      indexes.push({
        indexName,
        indexYYYYMM,
        indexDisplayName,
        aliasName,
        displayLabels,
        dateRange,
        dateRangeFull
      });
    }

    this.availableElasticIndexes = indexes;
    this.uniqueElasticIndexes = this._dedupeIndexesIgnoringAlias(indexes)
      .sort((a, b) => {
        // sort by date
        if( a.indexYYYYMM > b.indexYYYYMM ) return 1;
        if( a.indexYYYYMM < b.indexYYYYMM ) return -1;
      }
    );

    await this._updatePreviewingState();
  }

  _updateVersionStats() {
    // update the public/latest info, and show errors if there are mismatches or pending versions
    let publicIndex = this.availableElasticIndexes.find(i => i.aliasName.includes(APP_CONFIG.esAliases.current));
    let latestIndex = this.availableElasticIndexes.find(i => i.aliasName.includes(APP_CONFIG.esAliases.stage));

    this.publicIndexName = publicIndex?.indexDisplayName || '';
    this.publicIndexDateRange = publicIndex?.dateRangeFull || '';
    this.latestIndexName = latestIndex?.indexDisplayName || '';
    this.latestIndexDateRange = latestIndex?.dateRangeFull || '';

    this.dataVersionPending = this.publicIndexName !== this.latestIndexName;

    // TODO other statuses and mismatch stuff

    // this.dataVersionFailed = !!(latestIndex && publicIndex && latestIndex.indexName !== publicIndex.indexName && !latestIndex.displayLabels.toLowerCase().includes('public'));
    // this.dataVersionSuccess = !!(latestIndex && publicIndex && latestIndex.indexName === publicIndex.indexName);
    // this.dataMismatch = !!(latestIndex && publicIndex && latestIndex.indexName !== publicIndex.indexName);
    // this.mismatchedIndexes = [{
    //   indexName: latestIndex?.indexName,
    //   aliasName: latestIndex?.aliasName
    // }, {
    //   indexName: publicIndex?.indexName,
    //   aliasName: publicIndex?.aliasName
    // }];
  }

  _dedupeIndexesIgnoringAlias(indexes=[]) {
    const unique = new Map();

    for( let index of indexes ) {
      const key = JSON.stringify({
        indexYYYYMM: index.indexYYYYMM,
        indexDisplayName: index.indexDisplayName,
        displayLabels: index.displayLabels,
        dateRange: index.dateRange
      });

      if( !unique.has(key) ) unique.set(key, index);
    }

    return Array.from(unique.values());
  }

  async _onPreviewIndexDropdownChange(e) {
    this.currentPreviewIndex = e.detail.value === 'Select data version' ? '' : e.detail.value;
    await this.requestUpdate();  
    await this._updateSlimSelectStyles();
  }

  async _onPreviewIndex(e) {
    await this._updatePreviewingState();

    await indexedDb.setElasticsearchIndexes(this.availableElasticIndexes);


    // TODO fix preview index
    // 1- refresh when previewing isn't updating the dropdown with the `Previewing` label
    // 2- when previewing an index without an alias (like a previous week), 
    //    the api responds with data from the wrong index, like the preview is ignored



    // send to fin-app
    this.dispatchEvent(
      new CustomEvent('preview-es-index', {
        detail : {
          savedIndex : this.currentPreviewIndex
        }
      })
    );

    await this.requestUpdate();  
    await this._updateSlimSelectStyles();
  }

  async _updatePreviewingState() {
    let res = await indexedDb.getElasticsearchIndexes();
    // TODO need to fix, should pull saved preview index from indexedDb,
    //    but doesn't appear to work on page refresh

    let current = APP_CONFIG.esAliases.current;
    current = current.charAt(0).toUpperCase() + current.slice(1);

    this.availableElasticIndexes.forEach(i => {
      i.previewEsIndex = i.indexDisplayName === this.currentPreviewIndex && !i.displayLabels.includes(current);
      if( i.previewEsIndex ) i.displayLabels.push('Previewing');
    });
  }

  async _onPublishIndexDropdownChange(e) {
    this.toPublishIndex = e.detail.value === 'Select data version' ? '' : e.detail.value;
    await this._updateSlimSelectStyles();
  }

  _onPublishIndex() {
    this.modalContent = `
      <p>
        Public site will switch from <strong>${this.publicIndexName}</strong> to <strong>${this.toPublishIndex}</strong>.
      </p>
      <p>This change is immediate and visible to users.</p>
    `;

    this.showModal = true;
    this.modalSaveText = 'Publish';
  }

  async _onModalSave() {
    this.showModal = false;

    if( this.manageDataAction === 'publish' ) {
      let indexesToSwitch = this.availableElasticIndexes.filter(a => a.indexDisplayName === this.toPublishIndex).map(a => {
          return {
              indexName: a.indexName,
              aliasName: a.indexName.split('-')?.[0]+'-'+APP_CONFIG.esAliases.current
          }
      });

      await this.SchemaModel.setAlias(indexesToSwitch);

    } else if( this.manageDataAction === 'delete' ) {
      let indexesToDelete = this.availableElasticIndexes.filter(a => a.indexDisplayName === this.toPublishIndex).map(a => a.indexName);
      await this.SchemaModel.deleteIndex(indexesToDelete);
      await this._getAvailableElasticIndexes();
    }


    // TODO 
    // 1- clear selected preview index in fin-app
    // 2- update stats section and banners
    // 3- update dropdowns
    // 4- also badness with display labels and disabled options when 
    //   previewing and then going to publish dropdown
    // 


    this._clearCache();
    await this._getAvailableElasticIndexes();
  }

  async _onDeleteIndexDropdownChange(e) {
    this.toDeleteIndex = e.detail.value === 'Select data version' ? '' : e.detail.value;
    await this._updateSlimSelectStyles();
  }

  async _onDeleteIndex() {
    this.modalContent = `
      <p>
        Permanently delete <strong>${this.toDeleteIndex}</strong>.
      </p>
      <p style="color: #C10230;">Deleted data cannot be restored.</p>
    `;

    this.showModal = true;
    this.modalSaveText = 'Delete';
  }

  async _updateSlimSelectStyles() {
    // hack to update styles
    // the collapsed state should have 2 rows of text
    // and disabled options should be greyed out/disabled
    let slimSelects = this.shadowRoot.querySelectorAll('.manage-content ucd-theme-slim-select');
    for (let s of slimSelects) {
      await s.updateComplete;

      let collapsedDisplay = s.shadowRoot.querySelector('.ss-main .ss-single-selected .placeholder span');
      if( collapsedDisplay ) collapsedDisplay.style.gap = '.4rem';      

      let options = s.shadowRoot.querySelectorAll('.ss-option');
      options.forEach(o => {
        if( o.classList.contains('ss-disabled') ) {
          let spans = o.querySelectorAll('span');
          spans.forEach(s => {
            s.style.color = 'inherit';
            s.style.backgroundColor = 'inherit';
          });

          o.style.cursor = 'not-allowed';
          o.style.color = '#dedede';
          o.style.backgroundColor = '#fff';
        }
      });

      let ssMain = s.shadowRoot.querySelector('.ss-main');
      if( ssMain ) {
        ssMain.style.cssText = 'height: 4rem !important;';

        let singleSelected = ssMain.querySelector('.ss-single-selected');
        if( singleSelected ) singleSelected.style.cssText = 'height: 4rem !important;';
      }
    }
  }

  _formatWeekRange(weekStart, weekEnd, useFullMonth = false) {
    let locale = 'en-US';
    let monthDayOptions = {
      month: useFullMonth ? 'long' : 'short',
      day: 'numeric'
    };

    let dayOnlyOptions = {
      day: 'numeric'
    };

    let sameMonthAndYear =
      weekStart.year === weekEnd.year &&
      weekStart.month === weekEnd.month;

    let startText = weekStart.toLocaleString(locale, monthDayOptions);
    let endText = sameMonthAndYear
      ? weekEnd.toLocaleString(locale, dayOnlyOptions)
      : weekEnd.toLocaleString(locale, monthDayOptions);

    return `${startText} – ${endText}`;
  }

  _clearCache() {    
    this.BrowseByModel.store.data.byExpertsAZ.purge();
    this.BrowseByModel.store.data.byGrantsAZ.purge();
    this.BrowseByModel.store.data.byWorksAZ.purge();
    this.BrowseByModel.store.data.byExpertsLastInitial.purge();
    this.BrowseByModel.store.data.byGrantsLastInitial.purge();
    this.BrowseByModel.store.data.byWorksLastInitial.purge();
    
    this.ExpertModel.store.data.byId.purge();
    this.GrantModel.store.data.byId.purge();
    this.WorkModel.store.data.byId.purge();
    this.SearchModel.store.data.bySearchQuery.purge();
  }
}

customElements.define('app-admin', AppAdmin);
