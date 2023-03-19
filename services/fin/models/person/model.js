const {ElasticSearchModel} = require('@ucd-lib/fin-service-utils');

class PersonModel extends ElasticSearchModel {

  constructor() {
    super('person');
    this.transformService = 'es-person-transform';
  }

  is(id, types=[]) {
    if( id.match(/^\/person\//) ) return true;
    return false;
  }

}

module.exports = new PersonModel();
