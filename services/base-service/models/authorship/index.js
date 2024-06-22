const AuthorshipModel = require('./model.js');
module.exports = {
//  api : require('./api.js'),
  model : new AuthorshipModel(),
  schema : require('../base/schema/minimal.json'),
  transform: require('../base/transform.js')
}
