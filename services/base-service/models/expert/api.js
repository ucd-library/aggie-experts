const router = require('express').Router();
const {dataModels,logger} = require('@ucd-lib/fin-service-utils');
const ExpertModel = require('./model.js');
const utils = require('../utils.js')
const {defaultEsApiGenerator} = dataModels;

router.get('/test', async (req, res) => {
  logger.info('test');
  res.send('ok');
});

const model = new ExpertModel();
module.exports = defaultEsApiGenerator(model, {router});


module.exports = router;
