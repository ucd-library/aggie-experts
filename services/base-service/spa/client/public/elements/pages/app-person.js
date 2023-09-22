import { LitElement } from 'lit';
import {render} from "./app-person.tpl.js";

// sets globals Mixin and EventInterface
import "@ucd-lib/cork-app-utils";

import '@ucd-lib/theme-elements/ucdlib/ucdlib-md/ucdlib-md.js';
import "@ucd-lib/theme-elements/ucdlib/ucdlib-icon/ucdlib-icon";
import '../utils/app-icons.js';

import Cite from 'citation-js';

export default class AppPerson extends Mixin(LitElement)
  .with(LitCorkUtils) {

  static get properties() {
    return {
      personId : { type : String },
      person : { type : Object },
      personName : { type : String },
      introduction : { type : String },
      showMoreAboutMeLink : { type : Boolean },
      orcId : { type : String },
      scopusId : { type : String },
      citations : { type : Array },
      citationsDisplayed : { type : Array },
    }
  }

  constructor() {
    super();
    this._injectModel('AppStateModel', 'PersonModel');

    this.personId = '';
    this.person = {};
    this.personName = '';
    this.introduction = '';
    this.showMoreAboutMeLink = false;
    this.orcId = '';
    this.scopusId = '';

    this.citations = [];
    this.citationsDisplayed = [];

    this.render = render.bind(this);
  }

  async firstUpdated() {
    if( this.personId && this.personId === 'person/66356b7eec24c51f01e757af2b27ebb8' ) return;

    this._onAppStateUpdate(await this.AppStateModel.get());
  }

  /**
   * @method _onAppStateUpdate
   * @description bound to AppStateModel app-state-update event
   *
   * @return {Object} e
   */
  async _onAppStateUpdate(e) {
    if( e.location.page !== 'experts' ) return;

    // TEMP hack
    this.personId = 'person/66356b7eec24c51f01e757af2b27ebb8';
    await this.PersonModel.get(this.personId);
  }

  /**
   * @method _onPersonUpdate
   * @description bound to PersonModel person-update event
   *
   * @return {Object} e
   */
  async _onPersonUpdate(e) {
    if( e.state !== 'loaded' ) return;

    this.personId = e.id;
    this.person = e.payload;
    console.log('person payload', this.person);

    // update page data
    let graphRoot = this.person['@graph'].filter(item => item['@id'] === this.personId)[0];

    console.log('person graphRoot', graphRoot);
    this.personName = graphRoot.name;

    // max 500 characters, unless 'show me more' is clicked
    // TODO hack, remove, just testing longer intros
    this.introduction = graphRoot.overview + graphRoot.overview;
    this.showMoreAboutMeLink = this.introduction.length > 500;

    // TODO roles, title/dept/website/email

    this.orcId = graphRoot.orcidId;
    this.scopusId = graphRoot.scopusId;

    // TEMP hack for testing citationjs
    await this._loadCitations();
  }

  loadCitationPromise(doi) {
    return new Promise((resolve, reject) => {
      Cite.async(doi).then(citation => {

        // works mostly for citations
        let apa = citation.format('bibliography', {
          format: 'html',
          template: 'apa',
          lang: 'en-US'
        });

        let ris = citation.format('ris', {
          format: 'html',
          template: 'apa',
          lang: 'en-US'
        });

        resolve({
          ...citation.data[0],
          apa,
          ris
        });
      })
    });
  }

  async _loadCitations() {
    // this.citationDois = [];

    let citations = this.person['@graph'].filter(g => g.issued);
    citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]))
    // for( let element of citations ) {
    //   if( element.DOI ) {
    //     this.citationDois.push(element.DOI);
    //   }
    // }

    this.citations = await Promise.all(
      // this.citationDois.map(doi => this.loadCitationPromise(doi))
      citations.map((cite, index) => {
        let dateParts = cite.issued.split('-');
        let title = index === 0 ? 'Novel structural aspects of Sb<inf>2</inf>O<inf>3</inf>-B<inf>2</inf>O <inf>3</inf> glasses' : cite.title;
        let newCite = {
          DOI: cite.DOI,
          ISSN: cite.ISSN,
          author: cite.author,
          'container-title': cite['container-title'],
          language: cite.language,
          name: cite.name,
          publisher: cite.publisher,
          rank: cite.rank,
          title,//: cite.title,
          type: cite.type,
          volume: cite.volume,
          '@id': cite['@id'],
          '@type': cite['@type'],
          abstract: cite.abstract,
          'bibo:doi': cite['bibo:doi'],
          // 'bibo:status': cite['bibo:status'],
          eissn: cite.eissn,
          genre: cite.genre,
          hasPublicationVenue: cite.hasPublicationVenue,
          'is-visible': cite['is-visible'],
          // issued: cite.issued, // '2017-02' // date is expected to be in array of date-parts
          issued: {
            'date-parts': dateParts
          },
          // medium: cite.medium, // shows [Undetermined] for first record of Quinns
          pagination: cite.pagination,
          // status: cite.status, // breaks publish date
        };
        return this.loadCitationPromise(newCite);
      })
    );

    // also remove issued date from citations if not first displayed on page from that year
    let lastPrintedYear;
    this.citations.forEach((cite, i) => {
      let newIssueDate = cite.issued?.['date-parts']?.[0]
      if( i > 0 && newIssueDate === this.citations[i-1].issued?.['date-parts']?.[0] || lastPrintedYear === newIssueDate ) {
        delete cite.issued;
        lastPrintedYear = newIssueDate;
      }
    });
    console.log('this.citations', this.citations);
    this.citationsDisplayed = this.citations.slice(0, 10);

    this.requestUpdate();
  }

  _downloadRIS(e) {
    e.preventDefault();

    let text = this.citations.map(c => c.ris).join('\n');
    let blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    console.log('url', url)

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'data.txt');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  _seeAllWorks(e) {
    e.preventDefault();

    // TODO things
  }

}

customElements.define('app-person', AppPerson);
