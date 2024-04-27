const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/default.json');
const experts = new ExpertModel();

router.get('/', async (req, res) => {
  const params = {};

  ["inner_hit_size","size","page","q"].forEach((key) => {
    if (req.query[key]) { params[key] = req.query[key]; }
  });
  opts = {
    id: template.id,
    params
  };
  try {
    await experts.verify_template(template);
    const find = await experts.search(opts);
    res.send(find);
  } catch (err) {
    res.status(400).send('Invalid request');
  }
});

module.exports = router;
