let {Registry} = require('@ucd-lib/cork-app-utils');

const models =  {
  AppStateModel : require('./models/AppStateModel'),
  WorkModel : require('./models/WorkModel'),
  ExpertModel : require('./models/ExpertModel'),
  SearchModel : require('./models/SearchModel'),
  BrowseByModel : require('./models/BrowseByModel'),
  GrantModel : require('./models/GrantModel')
};

Registry.ready();

module.exports = models;
