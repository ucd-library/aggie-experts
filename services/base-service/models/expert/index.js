const ExpertModel = require('./model.js');
module.exports = {
  api : require('./api.js'),
  model : new ExpertModel(),
  schema : require('../experts/schema/minimal.json'),
  transform: require('../experts/transform.js')
}
