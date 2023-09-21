const router = require('express').Router();
const {middleware} = require('@ucd-lib/fin-service-utils');
const HomeModel = require('./model.js');
const utils = require('../utils.js')


const home = new HomeModel();

router.get('/default_text_weights', async (req, res) => {
  res.send(home.weights());
});

router.get('/search_body', async (req, res) => {
  res.send(home.elastic_search_query());
});

module.exports = router;
