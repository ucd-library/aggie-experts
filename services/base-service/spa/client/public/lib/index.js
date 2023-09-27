let {Registry} = require('@ucd-lib/cork-app-utils');

const models =  {
  AppStateModel : require('./models/AppStateModel'),
  WorkModel : require('./models/WorkModel'),
  PersonModel : require('./models/PersonModel')
};

Registry.ready();

module.exports = models;
