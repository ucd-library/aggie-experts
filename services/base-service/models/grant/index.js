const GrantModel = require('./model.js');
module.exports = {
  api : require('./api.js'),
  model : new GrantModel(),
  schema : require('../experts/schema/minimal.json'),
  transform: require('../experts/transform.js')
}
