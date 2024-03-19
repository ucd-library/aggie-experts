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
    index: "expert-read",
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
  let template = "default";

  // If template parameter is passed, check admin status
  if (req.query.template) {
    if (req.user?.roles?.includes('admin')) {
      template = req.query.template;
    } else {
      res.status(401).send('Unauthorized parameter(s)');
    }
  }

  ["inner_hit_size","size","page","q"].forEach((key) => {
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

router.get('/hello', (req, res) => {
    res.send("Cruel World");
});

module.exports = router;
