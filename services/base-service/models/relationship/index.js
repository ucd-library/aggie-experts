const RelationshipModel = require('./model.js');
module.exports = {
  api : require('./api.js'),
  model : new RelationshipModel(),
  schema : require('../experts/vivo.json'),
  transform: require('../experts/transform.js')
}
