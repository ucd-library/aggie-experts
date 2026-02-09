var {BaseStore} = require('@ucd-lib/cork-app-utils');

class SchemaStore extends BaseStore {

  constructor() {
    super();

    this.events = {
      SCHEMA_INDEXES_UPDATE : 'schema-indexes-update'
    }
  }

}

module.exports = new SchemaStore();
