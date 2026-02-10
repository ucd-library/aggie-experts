import { LitElement } from 'lit';
import {render} from "./app-admin.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import '@ucd-lib/theme-elements/brand/ucd-theme-list-accordion/ucd-theme-list-accordion.js'

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
      uniqueElasticIndexes : { type : Array }
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'SchemaModel');

    this.isLoggedIn = APP_CONFIG.user?.preferred_username ? true : false;
    this.availableElasticIndexes = [];
    this.uniqueElasticIndexes = [];
    this.currentElasticIndex = '';
    this.isAdmin = (APP_CONFIG.user?.roles || []).includes('admin') || false;

    this.currentDate = '';
    this.yearWeek = '';
    this.dateRangeStart = '';
    this.dateRangeEnd = '';

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
    
    let { dateRangeStart, dateRangeEnd } = this._getDateRangeForWeek();
    this.dateRangeStart = dateRangeStart;
    this.dateRangeEnd = dateRangeEnd;
    this.currentDate = new Date().toISOString().split('T')[0];
    this.yearWeek = this._getYearWeekInterval();

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
      indexes.push({
        indexName,
        aliasName,
        displayName : indexYYYYMM + ' (' + aliasName.split('-')?.[1] + ')'
      });
    }

    this.availableElasticIndexes = indexes;
    this.uniqueElasticIndexes = [...new Set(indexes.map(i => i.displayName))];

    console.log('availableElasticIndexes', this.availableElasticIndexes);
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

    // trigger api save? or just on next page load?
  }

  _getDateRangeForWeek(currentDate = new Date()) {
    const date = new Date(currentDate);
    const day = date.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
    const mondayOffset = day === 0 ? -6 : 1 - day;

    const dateRangeStart = new Date(date);
    dateRangeStart.setDate(date.getDate() + mondayOffset);
    dateRangeStart.setHours(0, 0, 0, 0);

    const dateRangeEnd = new Date(dateRangeStart);
    dateRangeEnd.setDate(dateRangeStart.getDate() + 5);
    dateRangeEnd.setHours(23, 59, 59, 999);

    return { 
      dateRangeStart: dateRangeStart.toISOString().split('T')[0], 
      dateRangeEnd: dateRangeEnd.toISOString().split('T')[0] 
    };
  }

  _getYearWeekInterval(currentDate = new Date(), { padWeek = false } = {}) {
    const date = new Date(currentDate);
    const day = date.getDay(); // 0=Sun..6=Sat
    const mondayOffset = day === 0 ? -6 : 1 - day;

    // Start of this week (Monday)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    // Week number: count Mondays since Jan 1
    const year = date.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay();
    const jan1MondayOffset = jan1Day === 0 ? -6 : 1 - jan1Day;

    const firstWeekMonday = new Date(jan1);
    firstWeekMonday.setDate(jan1.getDate() + jan1MondayOffset);
    firstWeekMonday.setHours(0, 0, 0, 0);

    const weekNumber = Math.floor((weekStart - firstWeekMonday) / (7 * 24 * 60 * 60 * 1000)) + 1;
    const weekStr = padWeek ? String(weekNumber).padStart(2, "0") : String(weekNumber);

    return `${year}-${weekStr}`;
  }

}

customElements.define('app-admin', AppAdmin);
