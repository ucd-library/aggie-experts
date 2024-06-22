const SiteFarmModel = require('./model.js');
module.exports = {
  api: require('./api.js'),
  model: new SiteFarmModel(),
  schema: require('../base/schema/minimal.json'),
  transform: require('../base/transform.js')
}
