const router = require('express').Router();
const {dataModels,logger} = require('@ucd-lib/fin-service-utils');
const ExpertModel = require('./model.js');
const utils = require('../utils.js')
const {defaultEsApiGenerator} = dataModels;
const md5 = require('md5');

router.get('/user', async (req, res) => {
  res.send(JSON.stringify(req.user));
});

router.get('/user', async (req, res) => {
  if( !req.user ) {
    res.status(401).send('Not logged in');
    return;
  }

  let roles = req.user.roles || [];

  if (req.query.expert) {
    const id= md5(req.user.preferred_username+"@ucdavis.edu")
    if (id === req.query.expert) {
      res.status(200).send(`${req.user.preferred_username} is ${req.query.expert}`);
    } else if (roles.includes('admin')) {
      res.status(200).send(`admins can edit ${req.query.expert}`);
    } else {
      res.status(401).send('Unauthorized');
    }
  } else {
    res.status(400).send('No expert specified');
  }
  return
});

const model = new ExpertModel();
module.exports = defaultEsApiGenerator(model, {router});


module.exports = router;
