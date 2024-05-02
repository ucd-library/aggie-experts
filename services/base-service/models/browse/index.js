const BrowseModel = require('./model.js');

module.exports = {
  api : require('./api.js'),
  model : new BrowseModel(),
  swagger: 'swagger.json'
}
