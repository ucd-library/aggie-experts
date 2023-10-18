const GranteeModel = require('./model.js');
module.exports = {
  api : require('./api.js'),
  model : new GranteeModel(),
  schema : require('../experts/schema/minimal.json'),
  transform: require('../experts/transform.js')
}
