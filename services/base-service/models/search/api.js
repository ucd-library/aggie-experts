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

router.get('/search', async (req, res) => {
  const query = req.query.text;
  const opts = {};
  if (req.query.size) { opts.size = req.query.size; }
  if (req.query.from) { opts.from = req.query.from; }
  res.send(await home.search(query, opts));
});

router.get('/put_template', async (req, res) => {
  console.log("put_template");
    res.send(await home.put_template());
});

router.get('/hello', (req, res) => {
    res.send("World");
});

module.exports = router;
