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
        let originalIssued = citation.data[0].issued;
        if( showDateInApa ) {
          citation.data[0].issued = parse(originalIssued);
        }

        let apa;
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
      })
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

}

module.exports = new Citation();
