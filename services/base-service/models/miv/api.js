// Routes for the MIV API
const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const md5 = require('md5');
const template = require('./template/miv_grants.json');
const expert = new ExpertModel();

router.get('/grants', async (req, res) => {
  const params = {};

  if (req.query.userId) {
    params.expert = 'expert/'+md5(`${req.query.userId}@ucdavis.edu`);
  }
  for (const key in template.script.params) {
    if (req.query[key]) {
      params[key] = req.query[key];
    } else {
      params[key] = template.script.params[key];
    }
  }

  opts = {
    id: template.id,
    params
  };
  try {
    await expert.verify_template(template);
    const find = await expert.search(opts);
    res.send(find);
  } catch (err) {
    // Write the error message to the console
    console.error(err);
    res.status(400).send(err);
    // res.status(400).send('Invalid request - no likey');
  }
});

module.exports = router;
