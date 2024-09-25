import { LitElement } from 'lit';
import {render, styles} from "./app-grant.tpl.js";

// import {Mixin, MainDomElement} from '@ucd-lib/theme-elements/utils/mixins';

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../../components/contributor-row.js';
import '../../utils/app-icons.js';


export default class AppGrant extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      grantId : { type : String },
      grantName : { type : String },
      awardedBy : { type : String },
      grantNumber : { type : String },
      grantAdmin : { type : String },
      purpose : { type : String },
      pis : { type : Array },
      coPis : { type : Array },
      leaders : { type : Array },
      researchers : { type : Array },
      startDate : { type : String },
      endDate : { type : String },
      completed : { type : Boolean }
    }
  }

  static get styles() {
    return styles();
  }

  constructor() {
    super();

    this._injectModel('AppStateModel', 'GrantModel');

    this.grantId = '';
    this.grantName = '';
    this.awardedBy = '';
    this.grantNumber = '';
    this.grantAdmin = '';
    this.purpose = '';
    this.pis = [];
    this.coPis = [];
    this.leaders = [];
    this.researchers = [];
    this.startDate = '';
    this.endDate = '';
    this.completed = false;

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
    if( e.location.page !== 'grant' ) return;
    window.scrollTo(0, 0);

    this.grantId = e.location.pathname.replace(/^\/grant\//, '');
    let grant = await this.GrantModel.get(this.grantId);
    this._onGrantUpdate(grant);
  }

  /**
   * @method _onGrantUpdate
   * @description bound to GrantModel grant-update event
   *
   * @return {Object} e
   */
  async _onGrantUpdate(e) {
    if( e.state !== 'loaded' ) return;
    if( this.AppStateModel.location.page !== 'grant' ) return;
    if( e.id !== this.grantId ) return;

    let grantGraph = (e.payload['@graph'] || []).filter(g => g['@id'] === this.grantId)?.[0] || {};
    let contributorsGraph = (e.payload['@graph'] || []).filter(g => g['@id'] !== this.grantId) || [];

    this.grantName = grantGraph.name || '';
    this.awardedBy = grantGraph.assignedBy?.name || '';
    this.grantNumber = grantGraph.sponsorAwardId || '';
    this.grantAdmin = grantGraph.assignedBy?.name || '';
    // this.purpose tbd

    let start = grantGraph.dateTimeInterval?.start?.dateTime;
    let end = grantGraph.dateTimeInterval?.end?.dateTime;
    this.startDate = start ? new Date(start).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    this.endDate = end ? new Date(end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    if( this.endDate && new Date(this.endDate) < new Date() ) {
      this.completed = true;
    }

    this.pis = [];
    this.coPis = [];
    this.leaders = [];
    this.researchers = [];
    contributorsGraph.forEach(contributor => {
      let name = contributor.contactInfo[0]?.name;
      let subtitle = name.split('§')?.pop()?.trim() || '';
      name = name.split('§')?.shift()?.trim() || '';

      let type = grantGraph.relatedBy.filter(r => r['inheres_in'] === contributor['@id'])?.[0]?.['@type'];
      if( !Array.isArray(type) ) type = [type];
      if( type.includes('PrincipalInvestigatorRole') ) {
        this.pis.push({
          id : contributor['@id'],
          name,
          subtitle
        });
      } else if( type.includes('CoPrincipalInvestigatorRole') ) {
        this.coPis.push({
          id : contributor['@id'],
          name,
          subtitle
        });
      } else if( type.includes('LeaderRole') ) {
        this.leaders.push({
          id : contributor['@id'],
          name,
          subtitle
        });
      } else {
        this.researchers.push({
          id : contributor['@id'],
          name,
          subtitle
        });
      }
    });
  }

}

customElements.define('app-grant', AppGrant);
