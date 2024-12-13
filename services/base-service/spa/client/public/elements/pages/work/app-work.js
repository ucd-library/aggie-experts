import { LitElement } from 'lit';
import {render, styles} from "./app-work.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../../components/contributor-row.js';
import '../../utils/app-icons.js';

import utils from '../../../lib/utils/index.js';

export default class AppWork extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      workId : { type : String },
      workName : { type : String },
      workType : { type : String },
      showFullText : { type : Boolean },
      ucLink : { type : String },
      publisherLink : { type : String },
      abstract : { type : String },
      publisher : { type : String },
      publishedPage : { type : String },
      publishedDate : { type : String },
      showPublished : { type : Boolean },
      showSubjects : { type : Boolean },
      showAuthors : { type : Boolean },
      authorsList : { type : Array },
    }
  }

  static get styles() {
    return styles();
  }

  constructor() {
    super();

    this._injectModel('AppStateModel', 'WorkModel');

    this.workId = '';
    this.workName = '';
    this.workType = 'article';

    this.ucLink = '';
    this.publisherLink = '';
    this.showFullText = false;

    this.abstract = '';

    this.publisher = '';
    this.publishedPage = '';
    this.publishedDate = '';
    this.showPublished = false;

    this.showSubjects = false; // TODO this might not be in v2.1

    this.showAuthors = false;
    this.authorsList = [];
    //   {
    //     hasProfile : true,
    //     id : 'expert/42',
    //     name : 'Lastname, Firstname 1',
    //     subtitle : 'Role, Title, Department 1'
    //   },
    //   {
    //     hasProfile : true,
    //     id : 'expert/42',
    //     name : 'Lastname, Firstname 2',
    //     subtitle : 'Role, Title, Department 2'
    //   }
    // ];

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
    if( e.location.page !== 'work' ) return;
    window.scrollTo(0, 0);

    this.workId = e.location.pathname.replace(/^\/work\//, '');
    this._onWorkUpdate(await this.WorkModel.get(this.workId));
  }

  /**
   * @method _onWorkUpdate
   * @description bound to WorkModel work-update event
   *
   * @return {Object} e
   */
  async _onWorkUpdate(e) {
    if( e.state === 'error' ) {
      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
      return;
    }
    if( e.state !== 'loaded' ) return;
    if( this.AppStateModel.location.page !== 'work' ) return;
    if( e.workId !== this.workId ) return;

    let workGraph = (e.payload['@graph'] || []).filter(g => g['@id'] === this.workId)?.[0] || {};
    if( !workGraph ) return;

    console.log('workGraph', workGraph); // TODO remove

    this.workName = workGraph.title || '';
    this.workType = utils.getCitationType(workGraph.type) || '';

    // this.ucLink = '';
    // this.publisherLink = '';
    this.showFullText = true; // this.ucLink || this.publisherLink;

    // TODO ask QH, should this support markdown?
    this.abstract = workGraph.abstract || '';

    this.publisher = workGraph.publisher || '';
    this.publishedPage = workGraph.page || '';
    this.publishedDate = workGraph.issued || ''; // TODO this could be array type? also need to format
    this.showPublished = this.publisher && this.publishedPage && this.publishedDate;

    // this.showSubjects = true; // TODO this might not be in v2.1

    // this.showAuthors = true; // TODO hide if no authors
    // this.authorsList = [
    //   {
    //     hasProfile : true,
    //     id : 'expert/42',
    //     name : 'Lastname, Firstname 1',
    //     subtitle : 'Role, Title, Department 1'
    //   }
    // ];

  }

}

customElements.define('app-work', AppWork);
