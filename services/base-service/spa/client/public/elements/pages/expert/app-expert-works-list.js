import { LitElement } from 'lit';
import {render} from "./app-expert-works-list.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";
import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";
import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../../utils/app-icons.js';

import Citation from '../../../lib/utils/citation.js';
import utils from '../../../lib/utils';

export default class AppExpertWorksList extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      expertId : { type : String },
      expert : { type : Object },
      expertName : { type : String },
      citations : { type : Array },
      citationsDisplayed : { type : Array },
      totalCitations : { type : Number },
      paginationTotal : { type : Number },
      currentPage : { type : Number },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'ExpertModel');

    this.expertId = '';
    this.expert = {};
    this.expertName = '';
    this.citations = [];
    this.citationsDisplayed = [];
    this.totalCitations = 0;
    this.paginationTotal = 1;
    this.currentPage = 1;
    this.resultsPerPage = 25;
    this.isAdmin = (APP_CONFIG.user?.roles || []).includes('admin');
    this.isVisible = true;

    this.render = render.bind(this);
  }

  async firstUpdated() {
    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  willUpdate() {
    // hack, pagination links too wide
    let pagination = this.shadowRoot.querySelector('ucd-theme-pagination');
    if( !pagination ) return;

    let pageLinks = pagination.shadowRoot.querySelectorAll('.pager__item a') || [];
    pageLinks.forEach(link => {
      link.style.padding = '0.25rem';
    });
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @return {Object} e
   */
  async _onAppStateUpdate(e) {
    if( e.location.page !== 'works' ) {
      // reset data to first page of results
      this.currentPage = 1;
      return;
    }
    window.scrollTo(0, 0);

    let expertId = e.location.pathname.replace('/works', '');
    if( expertId.substr(0,1) === '/' ) expertId = expertId.substr(1);
    if( !expertId ) this.dispatchEvent(new CustomEvent("show-404", {}));

    try {
      let expert = await this.ExpertModel.get(
        expertId,
        `/works?page=${this.currentPage}&size=${this.resultsPerPage}`, // subpage
        utils.getExpertApiOptions({
          includeGrants : false,
          worksPage : this.currentPage,
          worksSize : this.resultsPerPage
        })
      );
      this._onExpertUpdate(expert);

      if( !this.isAdmin && !this.isVisible ) throw new Error();
    } catch (error) {
      console.warn('expert ' + expertId + ' not found, throwing 404');

      this.dispatchEvent(
        new CustomEvent("show-404", {})
      );
    }
  }

  /**
   * @method _onExpertUpdate
   * @description bound to ExpertModel expert-update event
   *
   * @return {Object} e
   */
  async _onExpertUpdate(e) {
    if( e.state !== 'loaded' ) return;
    if( this.AppStateModel.location.page !== 'works' ) return;

    this.expertId = e.id.split('/works')[0];
    this.expert = JSON.parse(JSON.stringify(e.payload));
    this.isVisible = this.expert['is-visible'];

    let graphRoot = (this.expert['@graph'] || []).filter(item => item['@id'] === this.expertId)[0];
    this.expertName = graphRoot.hasName?.given + (graphRoot.hasName?.middle ? ' ' + graphRoot.hasName.middle : '') + ' ' + graphRoot.hasName?.family;

    this.totalCitations = (this.expert?.totals?.works || 0) - (this.expert?.totals?.hiddenWorks || 0);

    await this._loadCitations();
  }

  /**
   * @method _loadCitations
   * @description load citations for expert async
   *
   * @param {Boolean} all load all citations, not just first 25, used for downloading all citations
   */
  async _loadCitations(all=false) {
    // TODO 'all' param broken now since we're subsetting in the backend. need to make a new request for all

    let citations = JSON.parse(JSON.stringify((this.expert['@graph'] || []).filter(g => g.issued)));
    this.citations = citations.map(c => {
      let citation = { ...c };
      citation.title = Array.isArray(citation.title) ? citation.title.join(' | ') : citation.title;
      return citation;
    });

    // TODO this might change, depending on if we fix data issues in the backend or report in the frontend
    // try {
    //   // sort by issued date desc, then by title asc
    //   citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]) || a.title.localeCompare(b.title))
    // } catch (error) {
    //   // validate issue date
    //   let validation = Citation.validateIssueDate(citations);
    //   if( validation.citations?.length ) console.warn(validation.error, validation.citations);

    //   // validate title
    //   validation = Citation.validateTitle(citations);
    //   if( validation.citations?.length ) console.warn(validation.error, validation.citations);

    // } finally {
      // filter out invalid citations
      // citations = citations.filter(c => typeof c.issued === 'string' && typeof c.title === 'string');

      // this.citations = citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]) || a.title.localeCompare(b.title));
    // }

    // let startIndex = (this.currentPage - 1) * this.resultsPerPage || 0;
    // let citationResults = all ? await Citation.generateCitations(this.citations) : await Citation.generateCitations(this.citations.slice(startIndex, startIndex + this.resultsPerPage));

    let citationResults = await Citation.generateCitations(this.citations);
    this.citationsDisplayed = citationResults.map(c => c.value || c.reason?.data);

    // also remove issued date from citations if not first displayed on page from that year
    let lastPrintedYear;
    this.citationsDisplayed.forEach((cite, i) => {
      if( !Array.isArray(cite.issued) ) cite.issued = cite.issued.split('-');
      let newIssueDate = cite.issued?.[0];
      if( i > 0 && ( newIssueDate === this.citationsDisplayed[i-1].issued?.[0] || lastPrintedYear === newIssueDate ) && i % this.resultsPerPage !== 0 ) {
        delete cite.issued;
        lastPrintedYear = newIssueDate;
      }
    });

    // update doi links to be anchor tags
    this.citationsDisplayed.forEach(cite => {
      if( cite.DOI && cite.apa ) {
        // https://doi.org/10.3389/fvets.2023.1132810</div>\n</div>
        cite.apa = cite.apa.split(`https://doi.org/${cite.DOI}`)[0]
                  + `<a href="https://doi.org/${cite.DOI}">https://doi.org/${cite.DOI}</a>`
                  + cite.apa.split(`https://doi.org/${cite.DOI}`)[1];
      }
    });

    this.paginationTotal = Math.ceil(this.totalCitations / this.resultsPerPage);

    this.requestUpdate();
  }

  /**
   * @method _onPaginationChange
   * @description bound to click events of the pagination element
   *
   * @param {Object} e click|keyup event
   */
  async _onPaginationChange(e) {
    e.detail.startIndex = e.detail.page * this.resultsPerPage - this.resultsPerPage;
    let maxIndex = e.detail.page * (e.detail.startIndex || this.resultsPerPage);
    if( maxIndex > this.totalCitations ) maxIndex = this.totalCitations;

    this.currentPage = e.detail.page;

    // await this._loadCitations();
    let expert = await this.ExpertModel.get(
      this.expertId,
      `/works?page=${this.currentPage}&size=${this.resultsPerPage}`, // subpage
      utils.getExpertApiOptions({
        includeGrants : false,
        worksPage : this.currentPage,
        worksSize : this.resultsPerPage
      })
    );
    this._onExpertUpdate(expert);

    window.scrollTo(0, 0);
  }


  /**
   * @method _returnToProfile
   * @description return to /expert/<id> page
   *
   * @return {Object} e
   */
  _returnToProfile(e) {
    e.preventDefault();

    // reset data to first page of results
    this.currentPage = 1;

    this.AppStateModel.setLocation('/'+this.expertId);
  }

}

customElements.define('app-expert-works-list', AppExpertWorksList);
