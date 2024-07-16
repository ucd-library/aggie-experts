const ExpertModel = require('./model.js');
module.exports = {
  api : require('./api.js'),
  model : new ExpertModel(),
  schema : require('../base/schema/minimal.json'),
  transform: require('../base/transform.js')
}
