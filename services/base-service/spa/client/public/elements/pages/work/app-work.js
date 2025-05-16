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
      publishedVolume : { type : String },
      publishedDate : { type : String },
      showPublished : { type : Boolean },
      showSubjects : { type : Boolean },
      showAuthors : { type : Boolean },
      ucAuthors : { type : Array },
      authors : { type : Array }
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
    this.publishedVolume = '';
    this.publishedDate = '';
    this.showPublished = false;

    this.showSubjects = false;

    this.showAuthors = false;
    this.ucAuthors = [];
    this.authors = [];
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

    if( !workGraph.relatedBy.find(r => r['is-visible']) ) {
      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
      return;
    }

    let contactsGraph = (e.payload['@graph'] || []).filter(g => g['@id'] !== this.workId);

    this.workName = workGraph.title || '';
    this.workType = utils.getCitationType(workGraph.type) || '';

    let authors = workGraph.author || [];
    if( !Array.isArray(authors) ) authors = [authors];
    authors.sort((a, b) => a.rank - b.rank);

    this.authors = authors.map(a => {
      let rankMatch = workGraph.relatedBy.filter(r => r.rank === a.rank)[0];
      if( rankMatch ) {
        let expertId = rankMatch.relates.filter(rel => rel.startsWith('expert/'))[0];
        return `<a href="/${expertId}">${a.given} ${a.family}</a>`;
      }
      if( !a.given ) a.given = '';
      if( !a.family ) a.family = '';
      return a.given + ' ' + a.family;
    });

    // build from doi first, then title
    this.ucLink = '';
    if( workGraph.DOI ) {
      this.ucLink = `https://search.library.ucdavis.edu/discovery/search?query=any,contains,${encodeURIComponent(workGraph.DOI)}&tab=UCSILSDefaultSearch&search_scope=DN_and_CI&vid=01UCD_INST:UCD&offset=0`;
    } else if( workGraph.title ) {
      this.ucLink = `https://search.library.ucdavis.edu/discovery/search?vid=01UCD_INST:UCD&query=any,contains,${encodeURIComponent(workGraph.title)}&tab=UCSILSDefaultSearch&search_scope=DN_and_CI`;
    }

    this.publisherLink = workGraph.DOI ? this.publisherLink = `https://doi.org/${workGraph.DOI}` : '';
    this.showFullText = this.ucLink || this.publisherLink;
    this.abstract = workGraph.abstract || '';

    let cite = await Citation.generateCitations([workGraph]);
    cite = cite[0]?.value;

    if( Array.isArray(workGraph['container-title']) ) workGraph['container-title'] = workGraph['container-title'][0];
    this.publisher = workGraph['container-title'] || '';

    // like if 185(6), 600–616 is a standard format we would show as 'Volume 185, Issue 6, 600-616'
    let publishedVolume = '';
    if( cite.volume ) publishedVolume += 'Volume ' + cite.volume;
    if( cite.issue && cite.volume ) publishedVolume += ', ';
    if( cite.issue ) publishedVolume += 'Issue ' + cite.issue;

    if( (cite.volume || cite.issue) && cite.page ) publishedVolume += ', ';
    if( cite.page ) publishedVolume += cite.page;
    this.publishedVolume = publishedVolume;

    let [ year, month, day ] = workGraph.issued?.split?.('-');
    this.publishedDate = utils.formatDate({ year, month, day });

    this.showPublished = this.publisher || this.publishedVolume || this.publishedDate;
    this.showSubjects = false;

    if( workGraph.relatedBy && !Array.isArray(workGraph.relatedBy) ) workGraph.relatedBy = [workGraph.relatedBy];
    this.ucAuthors = [];

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

          this.ucAuthors.push({
            hasProfile : true,
            id : expert['@id'],
            name,
            subtitle
          });
        }
      }
    });

    if( this.ucAuthors.length ) {
      this.showAuthors = true;
    }
  }
}

customElements.define('app-work', AppWork);
