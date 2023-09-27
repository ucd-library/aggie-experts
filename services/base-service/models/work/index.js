const WorkModel = require('./model.js');
module.exports = {
  api : require('./api.js'),
  model : new WorkModel(),
  schema : require('../experts/schema/minimal.json'),
  transform: require('../experts/transform.js')
}
