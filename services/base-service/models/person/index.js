const PersonModel = require('./model.js');
module.exports = {
  api : require('./api.js'),
  model : new PersonModel(),
  schema : require('../experts/schema/minimal.json'),
  transform: require('../experts/transform.js')
}
