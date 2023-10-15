const RelationshipModel = require('./model.js');
module.exports = {
  api : require('./api.js'),
  model : new AuthorshipModel(),
  schema : require('../experts/schema/minimal.json'),
  transform: require('../experts/transform.js')
}
