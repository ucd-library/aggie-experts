let {Registry} = require('@ucd-lib/cork-app-utils');

const models =  {
  AppStateModel : require('./models/AppStateModel'),
  BrowseByModel : require('./models/BrowseByModel'),
  DagsterModel : require('./models/DagsterModel'),
  ExpertModel : require('./models/ExpertModel'),
  GrantModel : require('./models/GrantModel'),
  SearchModel : require('./models/SearchModel'),
  WorkModel : require('./models/WorkModel')
};

Registry.ready();

module.exports = models;
