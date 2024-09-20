import { LitElement } from 'lit';
import {render, styles} from "./app-grant.tpl.js";

// import {Mixin, MainDomElement} from '@ucd-lib/theme-elements/utils/mixins';

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../../components/contributor-row.js';
import '../../utils/app-icons.js';

import utils from '../../../lib/utils/index.js';

export default class AppGrant extends Mixin(LitElement)
  .with(LitCorkUtils) {
    // .with(MainDomElement, LitCorkUtils) { // TODO bring back once cork-app-utils (and theme?) has been updated

  static get properties() {
    return {
      grantId : { type : String },
      grantName : { type : String },
      awardedBy : { type : String },
      grantNumber : { type : String },
      grantAdmin : { type : String },
      purpose : { type : String },
      contributors : { type : Array },
      startDate : { type : String },
      endDate : { type : String }
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
    this.contributors = [];
    this.startDate = '';
    this.endDate = '';

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

    console.log({payload: e.payload});
    this.grantName = grantGraph.name || '';
    this.awardedBy = grantGraph.assignedBy?.name || '';
    this.grantNumber = grantGraph.sponsorAwardId || '';
    this.grantAdmin = grantGraph.assignedBy?.name || '';
    // this.purpose tbd

    let start = grantGraph.dateTimeInterval?.start?.dateTime;
    let end = grantGraph.dateTimeInterval?.end?.dateTime;
    this.startDate = start ? new Date(start).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    this.endDate = end ? new Date(end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    // TODO get grant role, to organize contributors by type
    //  should we split contributors into different properties based on type, or filter in the template?
    // grantGraph.relatedBy.filter(r => r['inheres_in'] === 'expert/LDdgBTXN')[0]['@type']
    // utils.getGrantRole()


    this.contributors = [];
    contributorsGraph.forEach(contributor => {
      let name = contributor.contactInfo[0]?.name;
      let subtitle = name.split('§')?.pop()?.trim() || '';
      name = name.split('§')?.shift()?.trim() || '';

      this.contributors.push({
        id : contributor['@id'],
        name,
        subtitle,
      });
    });
  }

}

customElements.define('app-grant', AppGrant);
