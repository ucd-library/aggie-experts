let {Registry} = require('@ucd-lib/cork-app-utils');

const models =  {
  AppStateModel : require('./models/AppStateModel'),
  WorkModel : require('./models/WorkModel')
};

Registry.ready();

module.exports = models;
