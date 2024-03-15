const router = require('express').Router();
const BaseModel = require('../base/model.js');
const utils = require('../utils.js')

const experts = new BaseModel();

router.get('/render', async (req, res) => {
  const params = {};
  ["userId"].forEach((key) => {
    if (req.query[key]) { params[key] = req.query[key]; }
  });
  opts = {
    index: "expert-read",
    id: "miv_grants",
    params
  };
  try {
  const template = await experts.render(opts);
    res.send(template);
  } catch (err) {
    res.status(400).send('Invalid request');
  }
});

router.get('/grants', async (req, res) => {
  const params = {};
  let template = "miv_grants";

  ["userId"].forEach((key) => {
    if (req.query[key]) { params[key] = req.query[key]; }
  });
  opts = {
    index: "expert-read",
    id: template,
    params
  };
  try {
    const template = await experts.search(opts);
    res.send(template);
  } catch (err) {
    res.status(400).send('Invalid request');
  }
});

module.exports = router;
