const {dataModels} = require('@ucd-lib/fin-service-utils');
const schema = require('./vivo.json');
const {FinEsDataModel} = dataModels;

class WorkModel extends FinEsDataModel {

  constructor() {
    super('work');
    this.schema = schema;
    this.transformService = 'es-work-transform';
  }

  is(id) {
    if( id.match(/^\/work\//) ) {
      return true;
    }
    return false;
  }

}

module.exports = new WorkModel();
