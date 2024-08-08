const GrantModel = require('./model.js');
module.exports = {
  api : require('./api.js'),
  model : new GrantModel(),
  schema : require('../base/schema/minimal.json'),
  transform: require('../base/transform.js')
}
