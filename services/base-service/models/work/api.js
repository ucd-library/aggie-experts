const router = require('express').Router();
const {dataModels,logger} = require('@ucd-lib/fin-service-utils');
const WorkModel = require('./model.js');
const utils = require('../utils.js')
const {defaultEsApiGenerator} = dataModels;


const model = new WorkModel();
// module.exports = defaultEsApiGenerator(model, {router});
