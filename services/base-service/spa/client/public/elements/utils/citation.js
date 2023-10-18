import Cite from 'citation-js';
import { parse } from '@citation-js/date';

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

        // ris format expects date-parts structure
        let originalIssued = citation.data[0].issued;
        citation.data[0].issued = parse(originalIssued);

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
   *
   * @return {Array} citations
   */
  async generateCitations(citations) {
    let citationResults = await Promise.allSettled(
      citations.map((cite, index) => {
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
