const GranteeModel = require('./model.js');
module.exports = {
  api : require('./api.js'),
  model : new GranteeModel(),
  schema : require('../base/schema/minimal.json'),
  transform: require('../base/transform.js')
}
