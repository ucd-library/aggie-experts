import { LitElement } from 'lit';
import {render} from "./app-admin.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import '@ucd-lib/theme-elements/brand/ucd-theme-list-accordion/ucd-theme-list-accordion.js'

import { getYearWeek, getTodaysDate } from '../../../../../../harvest/lib/year-week.js';

import '../../components/modal-overlay.js';

import indexedDb from '../../../lib/utils/indexedDb.js';

export default class AppAdmin extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      isLoggedIn : { type : Boolean },
      availableElasticIndexes : { type : Array },
      currentElasticIndex : { type : String },
      isAdmin : { type : Boolean },
      currentDate : { type : String },
      yearWeek : { type : String },
      dateRangeStart : { type : String },
      dateRangeEnd : { type : String },
      uniqueElasticIndexes : { type : Array },
      showModal : { type : Boolean },
      modalTitle : { type : String },
      modalSaveText : { type : String },
      modalContent : { type : String },
      toSwitchIndex : { type : String }
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

    this.currentDate = '';
    this.yearWeek = '';
    this.dateRangeStart = '';
    this.dateRangeEnd = '';

    this.showModal = false;
    this.modalTitle = "Switch Index Alias";
    this.modalSaveText = "Switch Index";
    this.modalContent = "<p>Changing the alias will update the index the public application is currently using. Are you sure you want to switch the current index alias to point to this new index?</p>";
    this.toSwitchIndex = '';

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
    
    let yearWeek = getYearWeek({ allValues : true });
    let todaysDate = getTodaysDate();

    this.dateRangeStart = yearWeek.weekStart.toLocaleString();
    this.dateRangeEnd = yearWeek.weekEnd.toLocaleString();
    this.currentDate = todaysDate.toLocaleString();
    this.yearWeek = yearWeek.yearWeek;

    if( !(APP_CONFIG.user?.roles || []).includes('admin') ) {
      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
      return;
    } 

    if( this.isAdmin ) await this._getAvailableElasticIndexes();
  }

  async _getAvailableElasticIndexes() {
    if( !this.isAdmin ) return;
    
    let res = await this.SchemaModel.getIndexes();
    
    let indexes = [];
    for( let indexName in (res.body || {}) ) {
      let indexYYYYMM = indexName.replace(/^(experts|grants|works)-/, '');
      let aliasName = (res.body || {})[indexName]?.aliases?.[0];

      let displayName = indexYYYYMM;
      if( aliasName ) displayName += ' (' + aliasName.split('-')?.[1] + ')';
      if( aliasName?.includes('current') ) displayName += ' [Selected]';
      if( !aliasName ) aliasName = '(No alias)';

      indexes.push({
        indexName,
        aliasName,
        displayName
      });
    }

    this.availableElasticIndexes = indexes;
    this.uniqueElasticIndexes = [...new Set(indexes.map(i => i.displayName))];
  }

  async _onPreviewIndexChange(e) {
    let indexDisplayName = e.detail.value;

    this.availableElasticIndexes.forEach(i => {
      i.previewEsIndex = i.displayName === indexDisplayName && !i.displayName.includes('current');
    });

    await indexedDb.setElasticsearchIndexes(this.availableElasticIndexes);

    // send to fin-app
    this.dispatchEvent(
      new CustomEvent('preview-es-index', {
        detail : {
          savedIndex : indexDisplayName
        }
      })
    );
  }

  _onSwitchIndexDropdownChange(e) {
    this.toSwitchIndex = e.detail.value;
  }

  _onSwitchIndex() {
    this.modalContent = `
      <p>
        Changing the alias will update the index the public application is currently using. 
        Are you sure you want to switch the current index alias to point to 
        <strong>${this.toSwitchIndex}</strong>?</p>
    `;

    this.showModal = true;
  }

  async _onSaveIndexSwitch() {
    this.showModal = false;
    
    let indexesToSwitch = this.availableElasticIndexes.filter(a => a.displayName === this.toSwitchIndex).map(a => {
        return {
            indexName: a.indexName,
            aliasName: a.indexName.split('-')?.[0]+'-current'
        }
    });

    await this.SchemaModel.setAlias(indexesToSwitch);

    this._clearCache();

    // TODO clear selected preview index in fin-app

    await this._getAvailableElasticIndexes();
  }

  async _onDeleteIndex() {
    let indexesToDelete = this.availableElasticIndexes.filter(a => a.displayName === this.toSwitchIndex).map(a => a.indexName);

    await this.SchemaModel.deleteIndex(indexesToDelete);

    await this._getAvailableElasticIndexes();
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
