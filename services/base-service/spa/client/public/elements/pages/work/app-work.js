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

    let contactsGraph = (e.payload['@graph'] || []).filter(g => g['@id'] !== this.workId);

    this.workName = workGraph.title || '';
    this.workType = utils.getCitationType(workGraph.type) || '';

    this.ucLink = '';
    // 'get at UC' link is described https://library.ucdavis.edu/get-it-at-uc-links/
    // ALMA setup https://knowledge.exlibrisgroup.com/Alma/Product_Documentation/010Alma_Online_Help_(English)/030Fulfillment/080Configuring_Fulfillment/090Discovery_Interface_Display_Logic/010General_Electronic_Services#URL_Template
    // could be helpful https://cdlib.org/services/collections/licensed/policy/uc-libraries-interface-branding/

    // example 'get at UC' link in the wild:
    // https://www.webofscience.com/wos/woscc/summary/949d9c8a-2c02-42d9-83ab-5f9f0cb26902-0137e027a1/relevance/1

    // example 'get at UC' link with the params split:
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

    // tried only with doi
    // https://search.library.ucdavis.edu/discovery/openurl?institution=01UCD_INST&rft_id=info:doi%2F10.3390%2Fijms19010070
    // full link
    // https://search.library.ucdavis.edu/discovery/openurl?institution=01UCD_INST&vid=01UCD_INST:UCD&rft_val_fmt=info:ofi%2Ffmt:kev:mtx:journal&rft.stitle=INT%20J%20MOL%20SCI&rft.volume=19&rft_id=info:doi%2F10.3390%2Fijms19010070&rfr_id=info:sid%2Fwebofscience.com:WOS:WOSCC&rft.jtitle=INTERNATIONAL%20JOURNAL%20OF%20MOLECULAR%20SCIENCES&rft.aufirst=Tzu-Kai&rft.genre=article&rft.issue=1&url_ctx_fmt=info:ofi%2Ffmt:kev:mtx:ctx&rft.aulast=Lin&url_ver=Z39.88-2004&rft.artnum=ARTN%2070&rft.auinit=TK&rft.date=2018&rft.au=Lin,%20TK&rft.au=Zhong,%20LL&rft.au=Santiago,%20JL&rft.atitle=Anti-Inflammatory%20and%20Skin%20Barrier%20Repair%20Effects%20of%20Topical%20Application%20of%20Some%20Plant%20Oils&rft.issn=1661-6596&rft.eissn=1422-0067

    this.publisherLink = workGraph.DOI ? this.publisherLink = `https://doi.org/${workGraph.DOI}` : '';

    this.showFullText = this.ucLink || this.publisherLink; // TODO test this that it hides when no links

    // math ML in abstract and title
    // TODO need to test, chemistry papers ie
    this.abstract = workGraph.abstract || '';

    // TODO for publisher/page/date, what are we doing on the expert page with citation-js? do same thing here
    // let citation = await Citation.generateCitations([workGraph]);
    // debugger;

    this.publisher = workGraph['container-title'] || '';
    this.publishedPage = workGraph.page || '';
    this.publishedDate = workGraph.issued || ''; // TODO this could be array type? also need to format

    this.showPublished = this.publisher && this.publishedPage && this.publishedDate;
    this.showSubjects = false;

    if( workGraph.relatedBy && !Array.isArray(workGraph.relatedBy) ) workGraph.relatedBy = [workGraph.relatedBy];
    this.authorsList = [];

    workGraph.relatedBy.forEach(r => {
      if( r['is-visible'] !== false ) {
        let expertId = r.relates.filter(rel => rel.startsWith('expert/'))[0];
        let expert = contactsGraph.filter(c => c['@id'] === expertId)[0];

        if( expert ) {
          let contactName = expert.contactInfo?.[0]?.name || '';
          if( Array.isArray(contactName) ) contactName = contactName[0];

          let name = contactName.split('§').shift().trim();
          let subtitle = contactName.split('§').pop().trim();
          if( name === subtitle ) subtitle = '';

          this.authorsList.push({
            hasProfile : true,
            id : expert['@id'],
            name,
            subtitle
          });
        }
      }
    });

    if( this.authorsList.length ) {
      this.showAuthors = true;
    }

    // TODO use rank? can't recall what was decided in chat with Quinn before winter break
    // does this affect list of authors at bottom of page, or just the order of names on search/browse?

  }

}

customElements.define('app-work', AppWork);
