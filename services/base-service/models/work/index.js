const WorkModel = require('./model.js');
module.exports = {
//  api : require('./api.js'),
  model : new WorkModel(),
  schema : require('../base/schema/minimal.json'),
  transform: require('../base/transform.js')
}
