const {dataModels} = require('@ucd-lib/fin-service-utils');
const schema = require('./vivo.json');
const {FinEsDataModel} = dataModels;

class PersonModel extends FinEsDataModel {

  constructor() {
    super('person');
    this.schema = schema;
    this.transformService = 'es-person-transform';
  }

  is(id) {
    if( id.match(/^\/person\//) ) {
      return true;
    }
    return false;
  }

}

module.exports = new PersonModel();
