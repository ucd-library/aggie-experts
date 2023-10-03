import { LitElement } from 'lit';
import {render} from "./app-search.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

import "@ucd-lib/theme-elements/brand/ucd-theme-pagination/ucd-theme-pagination.js";

import "../components/search-box";
import "../components/search-result-row";

export default class AppSearch extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      searchTerm : { type : String },
      searchResults : { type : Array },
      displayedResults : { type : Array },
      paginationTotal : { type : Number },
      currentPage : { type : Number },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel');

    this.searchTerm = '';
    this.searchResults = [];
    this.displayedResults = [];
    this.paginationTotal = 1;
    this.currentPage = 1;
    this.resultsPerPage = 20;

    this.render = render.bind(this);
  }

  firstUpdated() {
    if( this.AppStateModel.location.page !== 'search' ) return;

    // update search term
    this.searchTerm = this.AppStateModel.location.fullpath.replace('/search/', '');

    // TODO remove, or await _onAppStateUpdate() instead
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
   * @method _onSearch
   * @description called from the search box button is clicked or
   * the enter key is hit. search
   * @param {Object} e
   */
  _onSearch(e) {
    // let searchDoc = this.RecordModel.emptySearchDocument();
    // this.RecordModel.setTextFilter(searchDoc, e.detail);
    // this.RecordModel.setSearchLocation(searchDoc);

    // update url
    this.searchTerm = e.detail;
    this.AppStateModel.setLocation(`/search/${this.searchTerm}`);

    // TODO hit api
    let fakeResponse = [
      {
        "_source": {
          "@id": "person/66356b7eec24c51f01e757af2b27ebb8",
          "name": "Hart, Quinn § Application Development Programmer, Library",
          "websites": [ "https://www.library.ucdavis.edu/author/qhart/" ],
          "email": "",
          "roles": [ "role", "role" ]
        },
        "inner_hits": {
          "@graph": {
            "hits": {
              "total": {
                "value": 4,
                "relation": "eq"
              },
              "hits": [
                {
                    "@type": "Authored",
                    "name": "California Simulation of Evapotranspiration of Applied Water and Agricultural Energy Use in California § Ag Sci , 2018"
                },
                {
                    "@type": "Authored",
                    "name": "Daily reference evapotranspiration for California using satellite imagery and weather station measurement interpolation"
                },
                {
                    "@type": "Authored",
                    "name": "Sensor data dissemination systems using Web-based standards: a case study of publishing data in support of evapotranspiration models in California"
                }
              ]
            }
          }
        }
      },
      {
        "_source": {
          "@id": "person/51d37fccfdb86059c507a75b46cb0f66",
          "name": "Merz, Justin § Research Engineer, Library",
          "websites": [ "https://www.library.ucdavis.edu/author/justin-merz/" ],
          "email": "",
          "roles": [ "role", "role" ]
        },
        "inner_hits": {
          "@graph": {
            "hits": {
              "total": {
                "value": 1,
                "relation": "eq"
              },
              "hits": [
                {
                    "@type": "Authored",
                    "name": "Imaging Spectroscopy Processing Environment on the Cloud (ImgSPEC)"
                }
              ]
            }
          }
        }
      }
    ].map((r, index) => {
      let id = r['_source']['@id'];
      let name = r['_source'].name.split('§').shift().trim();
      let subtitle = r['_source'].name.split('§').pop().trim();
      let numberOfWorks = (r['inner_hits']['@graph'].hits.hits.filter(h => h['@type'] === 'Authored') || []).length;
      let numberOfGrants = (r['inner_hits']['@graph'].hits.hits.filter(h => h['@type'] === 'IP') || []).length;

      return {
        position: index+1,
        id,
        name,
        subtitle,
        numberOfWorks,
        numberOfGrants
      }
    });

    this.searchResults = fakeResponse;

    // this.searchResults = [
    //   '1',
    //   '2',
    //   '3',
    //   '4',
    //   '5',
    //   '6',
    //   '7',
    //   '8',
    //   '9',
    //   '10',
    //   '11',
    //   '12',
    //   '13',
    //   '14',
    //   '15',
    //   '16',
    //   '17',
    //   '18',
    //   '19',
    //   '20',
    //   '21',
    //   '22',
    //   '23',
    //   '24',
    //   '25',
    //   '26',
    //   '27'
    // ];

    this.currentPage = 1;
    this.paginationTotal = Math.ceil(this.searchResults.length / this.resultsPerPage);

    this.displayedResults = this.searchResults.slice(0, this.resultsPerPage);
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
  _onPaginationChange(e) {
    e.detail.startIndex = e.detail.page * this.resultsPerPage - this.resultsPerPage;
    let maxIndex = e.detail.page * (e.detail.startIndex || this.resultsPerPage);
    if( maxIndex > this.searchResults.length ) maxIndex = this.searchResults.length;

    this.displayedResults = this.searchResults.slice(e.detail.startIndex, maxIndex);
    this.currentPage = e.detail.page;
    window.scrollTo(0, 0);
  }

  /**
   * @method _downloadClicked
   * @description bound to download button click event
   *
   * @param {Object} e click|keyup event
   */
  _downloadClicked(e) {
    e.preventDefault();
    console.log('download clicked');

    //   let text = this.citations.map(c => c.ris).join('\n');
    //   let blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    //   let url = URL.createObjectURL(blob);
    //   console.log('url', url)

    //   const link = document.createElement('a');
    //   link.setAttribute('href', url);
    //   link.setAttribute('download', 'data.txt');
    //   link.style.display = 'none';
    //   document.body.appendChild(link);
    //   link.click();
    //   document.body.removeChild(link);
  }

}

customElements.define('app-search', AppSearch);
