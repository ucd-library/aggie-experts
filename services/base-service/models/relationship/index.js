const RelationshipModel = require('./model.js');
module.exports = {
  api : require('./api.js'),
  model : new RelationshipModel(),
  schema : require('../experts/schema/minimal.json'),
  transform: require('../experts/transform.js')
}
