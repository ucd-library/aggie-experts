const router = require('express').Router();
const BaseModel = require('../base/model.js');
const utils = require('../utils.js')

const experts = new BaseModel();

router.get('/render', async (req, res) => {
  const params = {};
  ["inner_hit_size","size","page","q"].forEach((key) => {
    if (req.query[key]) { params[key] = req.query[key]; }
  });
  opts = {
    index: "person-read",
    id: "default",
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
  const params = {};
  ["inner_hit_size","size","page","q"].forEach((key) => {
    if (req.query[key]) { params[key] = req.query[key]; }
  });
  opts = {
    index: "person-read",
    id: "default",
    params
  };
  try {
    const template = await experts.search(opts);
    res.send(template);
  } catch (err) {
    console.log('search/',err);
    res.status(400).send('Invalid request');
  }
});

router.get('/hello', (req, res) => {
    res.send("World");
});

module.exports = router;
