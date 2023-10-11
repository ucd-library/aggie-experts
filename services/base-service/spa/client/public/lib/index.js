let {Registry} = require('@ucd-lib/cork-app-utils');

const models =  {
  AppStateModel : require('./models/AppStateModel'),
  WorkModel : require('./models/WorkModel'),
  PersonModel : require('./models/PersonModel'),
  SearchModel : require('./models/SearchModel'),
};

Registry.ready();

module.exports = models;
