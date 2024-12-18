import { LitElement } from 'lit';
import {render, styles} from "./app-work.tpl.js";

// sets globals Mixin and EventInterface
import {Mixin, LitCorkUtils} from "@ucd-lib/cork-app-utils";

import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../../components/contributor-row.js';
import '../../utils/app-icons.js';

import Citation from '../../../lib/utils/citation.js';
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


    // 'get at UC' link is described https://library.ucdavis.edu/get-it-at-uc-links/
    // TODO but not sure how to construct the link
    this.ucLink = '';

    this.publisherLink = workGraph.DOI ? this.publisherLink = `https://doi.org/${workGraph.DOI}` : '';

    this.showFullText = this.ucLink || this.publisherLink; // TODO test this that it hides when no links

    // math ML in abstract and title
    // TODO need to test, chemistry papers ie
    this.abstract = workGraph.abstract || '';


    // TODO for publisher/page/date, what are we doing on the expert page with citation-js? do same thing here
    let citation = await Citation.generateCitations([workGraph]);
    debugger;
    this.publisher = workGraph['container-title'] || '';
    this.publishedPage = workGraph.page || '';
    this.publishedDate = workGraph.issued || ''; // TODO this could be array type? also need to format


    this.showPublished = this.publisher && this.publishedPage && this.publishedDate;

    this.showSubjects = false;

    // this.showAuthors = true; // TODO hide if no authors
    // this.authorsList = [
    //   {
    //     hasProfile : true,
    //     id : 'expert/42',
    //     name : 'Lastname, Firstname 1',
    //     subtitle : 'Role, Title, Department 1'
    //   }
    // ];
  //   relatedBy = [
  //     {
  //         "@id": "ark:/87287/d7mh2m/relationship/6891410",
  //         "@type": [
  //             "Authorship",
  //             "ucdlib:Authorship"
  //         ],
  //         "is-visible": true,
  //         "rank": 1,
  //         "relates": [
  //             "expert/B6IzGJXZ",
  //             "ark:/87287/d7mh2m/publication/3164416"
  //         ]
  //     }
  // ]
    if( workGraph.relatedBy && !Array.isArray(workGraph.relatedBy) ) workGraph.relatedBy = [workGraph.relatedBy];
    // this.authorsList = x

    // ask QH, relatedBy doesn't have name of expert, just expertId

  }

}

customElements.define('app-work', AppWork);
