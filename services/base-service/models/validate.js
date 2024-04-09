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

    result = await this._validateCitations(jsonld, result);

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

    // validate issue date
    let validation = Citation.validateIssueDate(citations);
    if( validation.citations?.length ) {
      validation.citations.forEach(c => {
        result.errors.push({
          label : validation.error,
          id : c['@id'],
        });
      });
    }

    // validate title
    validation = Citation.validateTitle(citations);
    if( validation.citations?.length ) {
      validation.citations.forEach(c => {
        result.errors.push({
          label : validation.error,
          id : c['@id'],
        });
      });
    }

    // validate is-visible
    validation = Citation.validateIsVisible(citations);
    if( validation.citations?.length ) {
      validation.citations.forEach(c => {
        result.errors.push({
          label : validation.error,
          id : c['@id'],
        });
      });
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
