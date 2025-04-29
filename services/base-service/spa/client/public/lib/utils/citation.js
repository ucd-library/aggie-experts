const Cite = require('citation-js');
const {parse, format} = require('@citation-js/date');

class Citation {
  /**
   * @method generateCitationPromise
   * @description load ciation using citation-js
   *
   * @param {String} citation citation object
   * @param {String} format citation format, defaults to html
   * @param {Boolean} hideApaTitle hide the title in the apa citation, defaults to tru
   * @param {Boolean} showDateInApa show date in the apa citation, defaults to false
   *
   * @return {Promise}
   */
  generateCitationPromise(citation, format='html', hideApaTitle=true, showDateInApa=false) {
    return new Promise((resolve, reject) => {
      Cite.async(citation).then(citation => {
        try {

          let originalIssued = citation.data[0].issued;
          if( showDateInApa ) {
            citation.data[0].issued = parse(originalIssued);
          }

          let apa;

          // remove doi from apa
          let originalDoi = citation.data[0].DOI;
          citation.data[0].DOI = '';

          if( hideApaTitle ) {
            let originalTitle = citation.data[0].title;
            citation.data[0].title = ''; // apa citation shouldn't include title in ui

            apa = citation.format('bibliography', {
              format,
              template: 'apa',
              lang: 'en-US'
            });

            citation.data[0].title = originalTitle;
          } else {
            apa = citation.format('bibliography', {
              format,
              template: 'apa',
              lang: 'en-US'
            });
          }

          // restore doi
          citation.data[0].DOI = originalDoi;

          // ris format expects date-parts structure, regardless if apa is showing date or not
          if( !showDateInApa ) {
            citation.data[0].issued = parse(originalIssued);
          }

          let ris = citation.format('ris', {
            format: 'html',
            template: 'apa',
            lang: 'en-US'
          });
          citation.data[0].issued = originalIssued.split('-');

          resolve({
            ...citation.data[0],
            apa,
            ris,
          });
        } catch(e) {
          console.warn('error generating citation for ' + citation.data[0]['@id'], e);
          reject({data: citation.data[0], error: e});
        }
      }).catch(e => {
        console.warn('error generating citation for ' + citation.data[0]['@id'], e);
        reject({data: citation.data[0], error: e});
      });
    });
  }

  /**
   * @method generateCitations
   * @description load citations using citation-js from list of fcrepo citations
   *
   * @param {Array} citations
   * @param {String} format citation format, defaults to html
   * @param {Boolean} hideApaTitle hide the title in the apa citation, defaults to true
   * @param {Boolean} showDateInApa show date in the apa citation, defaults to false
   *
   * @return {Array} citations
   */
  async generateCitations(citations, format='html', hideApaTitle=true, showDateInApa=false) {
    let citationResults = await Promise.allSettled(
      citations.map((cite, index) => {
        // explicitly remove troublemakers
        ["status","medium"].forEach(key => {
          delete cite[key];
        });
        return this.generateCitationPromise(cite, format, hideApaTitle, showDateInApa);
      })
    );
    return citationResults;
  }

  /**
   * @method validateIssueDate
   * @description validate citation issue date is a string
   *
   * @param {Array} citations
   *
   * @return {Object} invalid citations array as well as error message
   */
  validateIssueDate(citations) {
    citations = citations.filter(c => typeof c.issued !== 'string');

    return {
      citations,
      error : 'Invalid citation issue date, should be a string value'
    };
  }

  /**
   * @method validateTitle
   * @description validate citation title is a string
   *
   * @param {Array} citations
   *
   * @return {Object} invalid citations array as well as error message
   */
  validateTitle(citations) {
    citations = citations.filter(c => typeof c.title !== 'string');

    return {
      citations,
      error : 'Invalid citation title, should be a string value'
    };
  }

  /**
   * @method validateIsVisible
   * @description validate citation is visible
   *
   * @param {Array} citations
   *
   * @return {Object} invalid citations array as well as error message
   */
  validateIsVisible(citations) {
    citations = citations.filter(c => !c.relatedBy?.['is-visible']);

    return {
      citations,
      error : 'Invalid citation is-visible, should be true'
    };
  }

}

module.exports = new Citation();
