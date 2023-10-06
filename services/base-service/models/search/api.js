const router = require('express').Router();
const ExpertsModel = require('../experts/model.js');
const utils = require('../utils.js')

const home = new ExpertsModel();

router.get('/render', async (req, res) => {
  const query = req.query.text;
  const opts = {};
  if (req.query.size) { opts.size = req.query.size; }
  if (req.query.from) { opts.from = req.query.from; }
  res.send(await home.render(query, opts));
});

router.get('/', async (req, res) => {
  const query = req.query.text;
  const opts = {};
  ["size","page","q"].forEach((key) => {
    if (req.query[key]) { opts[key] = req.query[key]; }
  });
  res.send(await home.search(query, opts));
});

router.get('/hello', (req, res) => {
    res.send("World");
});

module.exports = router;
