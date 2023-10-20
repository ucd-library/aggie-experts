const GrantRoleModel = require('./model.js');
module.exports = {
  api : require('./api.js'),
  model : new GrantRoleModel(),
  schema : require('../base/schema/minimal.json'),
  transform: require('../base/transform.js')
}
