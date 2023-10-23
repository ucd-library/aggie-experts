import { LitElement } from 'lit';
import {render} from "./app-search.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";

import "../../components/search-box";
import "../../components/search-result-row";

import utils from '../../../lib/utils';
import { generateCitations } from '../../utils/citation.js';

export default class AppSearch extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      searchTerm : { type : String },
      searchResults : { type : Array },
      displayedResults : { type : Array },
      paginationTotal : { type : Number },
      currentPage : { type : Number },
      totalResultsCount : { type : Number },
      rawSearchData : { type : Object },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'SearchModel');

    this.searchTerm = '';
    this.searchResults = [];
    this.displayedResults = [];
    this.paginationTotal = 1;
    this.currentPage = 1;
    this.resultsPerPage = 25;
    this.totalResultsCount = 0;
    this.rawSearchData = {};

    this.render = render.bind(this);
  }

  firstUpdated() {
    if( this.AppStateModel.location.page !== 'search' ) return;

    // update search term
    this.searchTerm = this.AppStateModel.location.fullpath.replace('/search/', '');

    this._onSearch({ detail: this.searchTerm });
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
  _onAppStateUpdate(e) {
    if( e.location.page !== 'search' ) return;

    let searchTerm = e.location.fullpath.replace('/search/', '');
    if( searchTerm === this.searchTerm ) return;

    this.searchTerm = searchTerm;
    this._onSearch({ detail: this.searchTerm });
  }

  /**
   * @method _onPageSizeChange
   * @description bound to change events of the page size select element
   *
   * @param {Object} e
   *
   */
  _onPageSizeChange(e) {
    this.resultsPerPage = e.currentTarget.value;

    this._onSearch({ detail: this.searchTerm });
  }

  /**
   * @method _onSearch
   * @description called from the search box button is clicked or
   * the enter key is hit. search
   * @param {Object} e
   */
  async _onSearch(e) {
    if( !e.detail?.trim().length ) return;

    // update url
    this.searchTerm = e.detail.trim();

    this.AppStateModel.setLocation(`/search/${this.searchTerm}`);

    this.currentPage = 1;

    await this.SearchModel.search(this.searchTerm, this.currentPage, this.resultsPerPage);
  }

  _onSearchUpdate(e) {
    if( e.state !== 'loaded' ) return;
    this.rawSearchData = JSON.parse(JSON.stringify(e.payload));

    console.log('\''+ this.searchTerm +'\''+ ' results: ', e.payload);
    this.displayedResults = (e.payload?.hits || []).map((r, index) => {
      let id = r['@id'];
      let name = r.name?.split('§')?.shift()?.trim();
      let subtitle = r.name?.split('§')?.pop()?.trim();
      let numberOfWorks = (r['_inner_hits']?.filter(h => h['@type'] === 'Authored') || []).length;

      // let numberOfGrants = (r['_inner_hits']['@graph'].hits.hits.filter(h => h['@type'] === 'IP') || []).length;
      let numberOfGrants = 0; // TODO implement grants when ready

      return {
        position: index+1,
        id,
        name,
        subtitle,
        numberOfWorks,
        numberOfGrants
      }
    });

    this.totalResultsCount = e.payload.total;
    this.paginationTotal = Math.ceil(this.totalResultsCount / this.resultsPerPage);
  }

  /**
   * @method _selectAll
   * @description bound to click events of Select All checkbox
   *
   * @param {Object} e click|keyup event
   */
  _selectAll(e) {
    let checkboxes = [];
    let resultRows = (this.shadowRoot.querySelectorAll('app-search-result-row') || []);
    resultRows.forEach(row => {
      checkboxes.push(...row.shadowRoot.querySelectorAll('input[type="checkbox"]') || []);
    });

    checkboxes.forEach(checkbox => {
      checkbox.checked = e.currentTarget.checked;
    });
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
    if( maxIndex > this.searchResults.length ) maxIndex = this.searchResults.length;

    // this.displayedResults = this.searchResults.slice(e.detail.startIndex, maxIndex);
    this.currentPage = e.detail.page;
    await this.SearchModel.search(this.searchTerm, this.currentPage, this.resultsPerPage);
    window.scrollTo(0, 0);
  }

  /**
   * @method _downloadClicked
   * @description bound to download button click event
   *
   * @param {Object} e click|keyup event
   */
  async _downloadClicked(e) {
    e.preventDefault();

    let selectedPersons = [];
    let resultRows = (this.shadowRoot.querySelectorAll('app-search-result-row') || []);
    resultRows.forEach(row => {
      let checkbox = row.shadowRoot.querySelector('input[type="checkbox"]');
      if( checkbox?.checked ) {
        selectedPersons.push(row.result.id);
      }
    });

    if( !selectedPersons.length ) return;


    // TODO extra columns needed
    // Type of result (person, work, grant)
    // expert's name
    // type of field in which the keyword appears + field content
    // role in relation to the field
              // (e.g. if the field is the title/abstract of a publication, list whether this is a first or last author;
              // if it is a grant, list the role; no role is needed for subject keywords and bios)
    // AE profile landing page
    // expert's website
    // expert's email
    console.log('this.rawSearchData?.hits', this.rawSearchData?.hits);

    let body = [];
    let hits = (this.rawSearchData?.hits || []);
    for( let h = 0; h < hits.length; h++ ) {
      let result = hits[h];

      if( selectedPersons.includes(result['@id']) ) {
        console.log('selectedPersons', result);

        body.push([
          '"expert"',                                                                 // type of result
          '"' + result.name?.split('§')?.[0]?.trim() + '"',                           // experts name
          '""', // appears in / content
          '""', // role relation
          '"' + 'https://sandbox.experts.library.ucdavis.edu/' + result['@id'] + '"', // landing page
          '"' + (result.contactInfo?.hasURL || []).map(w => w.url).join('; ') + '"',   // websites
          '"' + result.contactInfo?.hasEmail?.replace('email:','')?.trim() + '"',     // email

          // no longer needed?
          // '"' + result.contactInfo?.hasTitle?.name?.trim() + '"',                     // role
          // '"' + result.contactInfo?.hasOrganizationalUnit?.name?.trim() + '"',        // department
        ]);

        let innerHits = (result['_inner_hits'] || []).filter(h => h['@type'] === 'Authored');

        let citationResults;
        if( innerHits.length ) citationResults = await generateCitations(innerHits, 'text', false, true);
        if( citationResults.length ) citationResults = citationResults.map(c => c.value || '');

        for( let ih = 0; ih < citationResults.length; ih++ ) {
          let inner = citationResults[ih];

          let firstAuthor = inner.author?.[0];
          let lastAuthor = inner.author?.[inner.author?.length-1];

          let authorsString = result.name?.split('§')?.[0]?.trim();
          if( firstAuthor ) {
            authorsString += ('; ' + firstAuthor.family + ', ' + firstAuthor.given);
          }
          if( lastAuthor ) {
            authorsString += ('; ' + lastAuthor.family + ', ' + lastAuthor.given);
          }

          console.log('citationResults', citationResults)

          body.push([
            '"work"',                                   // type of result
            '"NA"',                                     // experts name
            '"' + utils.getCitationType(inner.type) + ' - ' + inner.apa + '"',    // appears in / content
            '"' + authorsString + '"',                  // role relation
            '"NA"',                                     // landing page
            '"NA"',                                     // websites
            '"NA"'                                      // email
          ]);
        }
      }
    }

    if( !body.length ) return;

    let headers = ['type of result', 'experts name', 'appears in / content', 'role relation', 'landing page', 'websites', 'email'];
    let text = headers.join(',') + '\n';
    body.forEach(row => {
      text += row.join(',') + '\n';
    });

    let blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'data.csv');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

}

customElements.define('app-search', AppSearch);
