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
        let dateParts = cite.issued.split('-');

        let newCite = {
          DOI: cite.DOI,
          ISSN: cite.ISSN,
          author: cite.author,
          'container-title': cite['container-title'],
          language: cite.language,
          name: cite.name,
          publisher: cite.publisher,
          rank: cite.rank,
          title: cite.title,
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
        return generateCitationPromise(newCite);
      })
    );
    return citationResults;
  }

}

export const { generateCitations, generateCitationPromise } = new Citation();
