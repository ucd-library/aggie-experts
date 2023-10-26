const router = require('express').Router();
const BaseModel = require('../base/model.js');
const utils = require('../utils.js')

const experts = new BaseModel();

router.get('/render', async (req, res) => {
  const params = {
    size:25
  };
  ["size","page","p"].forEach((key) => {
    if (req.query[key]) { params[key] = req.query[key]; }
  });
  opts = {
    index: "expert-read",
    id: "family_prefix",
    params
  };
  try {
  const template = await experts.render(opts);
    res.send(template);
  } catch (err) {
    res.status(400).send('Invalid request');
  }
});

router.get('/', async (req, res) => {
  const params = {
    size: 25
  };
  ["size","page","p"].forEach((key) => {
    if (req.query[key]) { params[key] = req.query[key]; }
  });
  opts = {
    index: "expert-read",
    id: "family_prefix",
    params
  };
  try {
    const template = await experts.search(opts);
    res.send(template);
  } catch (err) {
    console.log('browse/',err);
    res.status(400).send('Invalid request');
  }
});

module.exports = router;
