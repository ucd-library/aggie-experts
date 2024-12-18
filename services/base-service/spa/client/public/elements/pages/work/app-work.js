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
    // ALMA setup in get it:
    // https://knowledge.exlibrisgroup.com/Alma/Product_Documentation/010Alma_Online_Help_(English)/030Fulfillment/080Configuring_Fulfillment/090Discovery_Interface_Display_Logic/010General_Electronic_Services#URL_Template

    // https://cdlib.org/services/collections/licensed/policy/uc-libraries-interface-branding/


    // wos https://www.webofscience.com/wos/woscc/summary/949d9c8a-2c02-42d9-83ab-5f9f0cb26902-0137e027a1/relevance/1 has links to 'get at uc'
      // https://search.library.ucdavis.edu/discovery/openurl?institution=01UCD_INST
      // &vid=01UCD_INST:UCD
      // &rft_val_fmt=info:ofi%2Ffmt:kev:mtx:journal
      // &rft.stitle=INT%20J%20MOL%20SCI
      // &rft.volume=19
      // &rft_id=info:doi%2F10.3390%2Fijms19010070
      // &rfr_id=info:sid%2Fwebofscience.com:WOS:WOSCC
      // &rft.jtitle=INTERNATIONAL%20JOURNAL%20OF%20MOLECULAR%20SCIENCES
      // &rft.aufirst=Tzu-Kai
      // &rft.genre=article
      // &rft.issue=1
      // &url_ctx_fmt=info:ofi%2Ffmt:kev:mtx:ctx
      // &rft.aulast=Lin
      // &url_ver=Z39.88-2004
      // &rft.artnum=ARTN%2070
      // &rft.auinit=TK
      // &rft.date=2018
      // &rft.au=Lin,%20TK
      // &rft.au=Zhong,%20LL
      // &rft.au=Santiago,%20JL
      // &rft.atitle=Anti-Inflammatory%20and%20Skin%20Barrier%20Repair%20Effects%20of%20Topical%20Application%20of%20Some%20Plant%20Oils
      // &rft.issn=1661-6596
      // &rft.eissn=1422-0067






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
