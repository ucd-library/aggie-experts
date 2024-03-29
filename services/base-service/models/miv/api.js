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
    // Modify for MIV format (old version)
    //jq '.hits[0]["_inner_hits"][0]| {"@id","title":.name,"end_date":.dateTimeInterval.end.dateTime,"start_date":.dateTimeInterval.start.dateTime,"grant_amount":.totalAwardAmount,"sponsor_id":.sponsorAwardId,"sponsor_name":.assignedBy.name,"type":.["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"].name,"role_label":(.relatedBy[] | select(.inheres_in) | .["@type"])}' new.json
    let grants = [];
    for (const hit of find.hits[0]._inner_hits) {
      grants.push({
        '@id': hit['@id'],
        title: hit.name,
        end_date: hit.dateTimeInterval.end.dateTime,
        start_date: hit.dateTimeInterval.start.dateTime,
        grant_amount: hit.totalAwardAmount,
        sponsor_id: hit.sponsorAwardId,
        sponsor_name: hit.assignedBy.name,
        type: hit['http://www.w3.org/1999/02/22-rdf-syntax-ns#type'].name,
        role_label: hit.relatedBy.find(x => x.inheres_in)['@type']
      });
      hit.relatedBy.forEach((x) => {
        if (! x.inheres_in) {
          grants.push({
            '@id': x['@id'],
            name: x.relates[0].name,
            role: x['@type']
          });
        }
      });
    }
    res.send({"@graph": grants});
  } catch (err) {
    // Write the error message to the console
    console.error(err);
    res.status(400).send(err);
    // res.status(400).send('Invalid request - no likey');
  }
});

module.exports = router;
