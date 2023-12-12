const {config} = require('@ucd-lib/fin-service-utils');
const Citation = require('../spa/client/public/lib/utils/citation.js');

class Validate {

  /**
   * @method validateExpert
   * @description validate an data model expert
   *
   * @param {Object} jsonld
   * @returns {Object}
   */
  async validateExpert(jsonld) {
    if( !jsonld ) {
      throw new Error('Elastic search response is empty');
    }

    let result = {
      id : jsonld['@id'],
      errors : [],
      warnings : [],
      comments : []
    };

    result = this._validateCitations(jsonld, result);

    return result;
  }

  /**
   * @method _validateCitations
   * @description validate citation structure and parsing with citation-js
   *
   * @param {Object} jsonld expert record
   * @param {Object} result result object to return errors/warnings
   * @returns {Object}
   */
  async _validateCitations(jsonld, result) {
    let citations = JSON.parse(JSON.stringify((jsonld['@graph'] || []).filter(g => g.issued)));

    try {
      // sort by issued date desc, then by title asc
      citations.sort((a,b) => Number(b.issued.split('-')[0]) - Number(a.issued.split('-')[0]) || a.title.localeCompare(b.title))
    } catch (error) {
      let invalidCitations = citations.filter(c => typeof c.issued !== 'string');
      if( invalidCitations.length ) {
        invalidCitations.forEach(c => {
          result.errors.push({
            label : 'Invalid citation issue date, should be a string value',
            id : c['@id'],
          });
        });
      }

      invalidCitations = citations.filter(c => typeof c.title !== 'string');
      if( invalidCitations.length ) {
        invalidCitations.forEach(c => {
          result.errors.push({
            label : 'Invalid citation title, should be a string value',
            id : c['@id'],
          });
        });
      }
      citations = citations.filter(c => typeof c.issued === 'string' && typeof c.title === 'string');
    }

    try {
      await Citation.generateCitations(citations);
    } catch (error) {
      result.errors.push({ label : 'Could not generate citations: ' + error.stack, id : jsonld['@id'] });
    }

    return result;
  }
}

module.exports = new Validate();
