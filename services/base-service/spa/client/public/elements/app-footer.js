import { LitElement, html } from 'lit';
import render from "./app-footer.tpl.js";

import "./auth/app-auth-footer";

class AppFooter extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return { 
      localBuildTime : {type: String},
      appVersion : {type: String},
      showVersion : {type: Boolean},
      buildNum : {type: String},
      clientEnv : {type: String},
      finAppVersion : {type: String},
      finBranchName : {type: String},
      finRepoTag : {type: String},
      finServerImage : {type: String},
      finServerRepoHash : {type: String},
      damsDeployBranch : {type: String},
      damsDeploySha : {type: String},
      damsDeployTag : {type: String},
      damsRepoBranch : {type: String},
      damsRepoSha : {type: String},
      damsRepoTag : {type: String}
    };
  }

  constructor() {
    super();
    this.active = true;
    this.render = render.bind(this);

    this.showVersion = APP_CONFIG.env.UCD_DAMS_DEPLOYMENT_BRANCH !== 'main';

    this.appVersion = APP_CONFIG.env.APP_VERSION;    
    this.buildNum = APP_CONFIG.env.BUILD_NUM;
    this.clientEnv = APP_CONFIG.env.CLIENT_ENV;
    this.finAppVersion = APP_CONFIG.env.FIN_APP_VERSION;
    this.finBranchName = APP_CONFIG.env.FIN_BRANCH_NAME;
    this.finRepoTag = APP_CONFIG.env.FIN_REPO_TAG;
    this.finServerImage = APP_CONFIG.env.FIN_SERVER_IMAGE;
    this.finServerRepoHash = APP_CONFIG.env.FIN_SERVER_REPO_HASH;
    this.damsDeployBranch = APP_CONFIG.env.UCD_DAMS_DEPLOYMENT_BRANCH;
    this.damsDeploySha = APP_CONFIG.env.UCD_DAMS_DEPLOYMENT_SHA;
    this.damsDeployTag = APP_CONFIG.env.UCD_DAMS_DEPLOYMENT_TAG;
    this.damsRepoBranch = APP_CONFIG.env.UCD_DAMS_REPO_BRANCH;
    this.damsRepoSha = APP_CONFIG.env.UCD_DAMS_REPO_SHA;
    this.damsRepoTag = APP_CONFIG.env.UCD_DAMS_REPO_TAG;

    if( APP_CONFIG.env.BUILD_TIME ) {
      this.localBuildTime = new Date(APP_CONFIG.env.BUILD_TIME).toISOString().replace('T', ' ');
    } else {
      this.localBuildTime = 'Not set';
    }   

    this._injectModel('AppStateModel');
  }  

  getLocalTime(date) {
    if( !date ) return '';
    date = new Date(date+'.000Z');

    return date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate()+' '+
     (date.getHours() > 12 ? date.getHours() - 12 : date.getHours())+':'+
     (date.getMinutes() < 10 ? '0' : '')+date.getMinutes()+
     (date.getHours() > 11 ? 'pm' : 'am');
  }
}

customElements.define('app-footer', AppFooter);