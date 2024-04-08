const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/family_prefix.json');

const experts = new ExpertModel();

router.get('/', async (req, res) => {
  const params = {
    size: 25
  };
  ["size","page","p"].forEach((key) => {
    if (req.query[key]) { params[key] = req.query[key]; }
  });

  if (params.p) {
    opts = {
      index: "expert-read",
      id: "family_prefix",
      params
    };

    try {
      await experts.verify_template(template);
      const find = await experts.search(opts);
      res.send(find);
    } catch (err) {
      res.status(400).send('Invalid request');
    }
  } else {
    try {
      await experts.verify_template(template);
      const search_templates=[];
      ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O",
       "P","Q","R","S","T","U","V","W","X","Y","Z"].forEach((letter) => {
         search_templates.push({});
         search_templates.push({id:"family_prefix",params:{p:letter,size:0}});
        });
      const finds = await experts.msearch({search_templates});
      res.send(finds);
    } catch (err) {
      res.status(400).send('Invalid request');
    }
  }
});

module.exports = router;
