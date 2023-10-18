const router = require('express').Router();
const {dataModels,logger} = require('@ucd-lib/fin-service-utils');
const WorkModel = require('./model.js');
const utils = require('../utils.js')
const {defaultEsApiGenerator} = dataModels;

router.get('/test', async (req, res) => {
  logger.info('test');
  res.send('ok');
});

const model = new WorkModel();
module.exports = defaultEsApiGenerator(model, {router});
