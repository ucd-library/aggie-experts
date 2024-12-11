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
      completed : { type : Boolean },
      showAboutSection : { type : Boolean },
      showContributorsSection : { type : Boolean }
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
    this.showAboutSection = false;
    this.showContributorsSection = false;

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
    this._onGrantUpdate(await this.GrantModel.get(this.grantId));
  }

  /**
   * @method _onGrantUpdate
   * @description bound to GrantModel grant-update event
   *
   * @return {Object} e
   */
  async _onGrantUpdate(e) {
    if( e.state === 'error' ) {
      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
      return;
    }
    if( e.state !== 'loaded' ) return;
    if( this.AppStateModel.location.page !== 'grant' ) return;
    if( e.grantId !== this.grantId ) return;

    let grantGraph = (e.payload['@graph'] || []).filter(g => g['@id'] === this.grantId)?.[0] || {};
    if( !grantGraph ) return;

    // Invisible grants still have resolvable landing pages. When the grant visibility has been changed, the expected behavior is:
    // 1. If there are no public relationships, the grant landing page should return a 404 for all users, including the owner of the grant
    let hasPublicRelationships = (grantGraph?.relatedBy || []).some(r => (r['inheres_in'] && r['is-visible']) || r['@id'].includes('#roleof_'));
    if( !hasPublicRelationships ) {
      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
      return;
    }

    let aeContributors = (e.payload['@graph'] || []).filter(g => g['@id'] !== this.grantId) || [];
    let otherContributors = [];

    this.grantName = grantGraph.name?.split('§')?.shift()?.trim() || '';
    this.awardedBy = grantGraph.assignedBy?.name || '';
    this.grantNumber = grantGraph.sponsorAwardId || '';
    this.grantAdmin = grantGraph.assignedBy?.name || '';
    // this.purpose tbd
    this.showAboutSection = (this.awardedBy || this.grantNumber || this.grantAdmin || this.purpose);

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

    let contributors = (grantGraph.relatedBy || []);
    if( !Array.isArray(contributors) ) contributors = [contributors];

    otherContributors = contributors.filter(c => !c['inheres_in']);

    aeContributors.forEach(contributor => {
      let name = contributor.contactInfo[0]?.name;
      let subtitle = name.split('§')?.pop()?.trim() || '';
      name = name.split('§')?.shift()?.trim() || '';

      let type = grantGraph.relatedBy.filter(r => r['inheres_in'] === contributor['@id'])?.[0]?.['@type'];
      if( !Array.isArray(type) ) type = [type];

      // 2. If there are other experts related to the grant, the grant landing page will continue to resolve, but
      //   --if the expert who changed the visibility setting is a PI or coPI,
      //        their name will continue to appear in the list of contributors, but not link back to their profile page
      //   --if that expert is a different type of contributor, they will be removed from the list of contributors
      let isVisible = grantGraph.relatedBy.filter(r => r['inheres_in'] === contributor['@id'])?.[0]?.['is-visible'];

      if( type.includes('PrincipalInvestigatorRole') ) {
        this.pis.push({
          hasProfile : isVisible,
          id : contributor['@id'],
          name,
          subtitle
        });
      } else if( type.includes('CoPrincipalInvestigatorRole') ) {
        this.coPis.push({
          hasProfile : isVisible,
          id : contributor['@id'],
          name,
          subtitle
        });
      } else if( isVisible && type.includes('LeaderRole') ) {
        this.leaders.push({
          hasProfile : true,
          id : contributor['@id'],
          name,
          subtitle
        });
      } else if( isVisible ) {
        this.researchers.push({
          hasProfile : true,
          id : contributor['@id'],
          name,
          subtitle
        });
      }
    });

    otherContributors.forEach(contributor => {
      let type = contributor['@type'];
      if( !Array.isArray(type) ) type = [type];


      // pull in relates use id? but includes #roleof_
      let relates = contributor['relates'];
      if( !Array.isArray(relates) ) relates = [relates];

      let personArk = contributor['@id']?.replace('roleof_', '') || '';
      let name = relates.filter(r => r['@id'] === personArk)?.[0]?.name || '';

      if( type.includes('PrincipalInvestigatorRole') ) {
        this.pis.push({
          hasProfile : false,
          id : personArk,
          name,
          subtitle: ''
        });
      } else if( type.includes('CoPrincipalInvestigatorRole') ) {
        this.coPis.push({
          hasProfile : false,
          id : personArk,
          name,
          subtitle: ''
        });
      } else if( type.includes('LeaderRole') ) {
        this.leaders.push({
          hasProfile : false,
          id : personArk,
          name,
          subtitle: ''
        });
      } else {
        this.researchers.push({
          hasProfile : false,
          id : personArk,
          name,
          subtitle: ''
        });
      }

    });

    this.showContributorsSection = (this.pis.length > 0 || this.coPis.length > 0 || this.leaders.length > 0 || this.researchers.length > 0);
  }

}

customElements.define('app-grant', AppGrant);
