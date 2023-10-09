import Cite from 'citation-js';

class Citation {
  /**
   * @method generateCitationPromise
   * @description load ciation using citation-js
   *
   * @param {String} citation citation object
   *
   * @return {Promise}
   */
  generateCitationPromise(citation) {
    return new Promise((resolve, reject) => {
      Cite.async(citation).then(citation => {
        let originalTitle = citation.data[0].title;
        citation.data[0].title = ''; // apa citation shouldn't include title in ui
        let apa = citation.format('bibliography', {
          format: 'html',
          template: 'apa',
          lang: 'en-US'
        });

        citation.data[0].title = originalTitle;
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

  /**
   * @method generateCitations
   * @description load citations using citation-js from list of fcrepo citations
   *
   * @param {Array} citations
   *
   * @return {Array} citations
   */
  async generateCitations(citations) {
    let citationResults = await Promise.allSettled(
      citations.map((cite, index) => {
        cite.issued = cite.issued.split('-');
        // explicitly remove troublemakers
        ["status","medium"].forEach(key => {
          delete cite[key];
        });
        return generateCitationPromise(cite);
      })
    );
    return citationResults;
  }

}

export const { generateCitations, generateCitationPromise } = new Citation();
