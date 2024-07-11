// Routes for the MIV API
const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/miv_grants.json');
const expert = new ExpertModel();

const { openapi, validate_admin_client, validate_miv_client, has_access, fetchExpertId } = require('../middleware.js')

router.get(
  '/user',
  validate_miv_client,
  has_access('miv'),
  // is_miv,
  validate_admin_client,
  fetchExpertId,
  async (req, res) => {
    const expertId = req.query.expertId;
    try {
      res.send(expertId);
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
    }
  }
);

function miv_valid_path(options = {}) {
  const def = {
    "description": "A JSON array an expert's grants",
  };

  (options.parameters || []).forEach((param) => {
    def.parameters.push(openapi.parameters(param));
  });

  delete options.parameters;

  return openapi.validPath({ ...def, ...options });
}

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
router.use(openapi);

const path = require('path');

router.get('/', (req, res) => {
  // Send the pre-made swagger.json file
  // res.sendFile(path.join(__dirname, 'swagger.json'));
  res.redirect('/api/miv/openapi.json');
});


router.get(
  '/grants',
  miv_valid_path(
    {
      description: "Returns a JSON array of an expert's grants",
      responses: {
        "200": openapi.response('Successful_operation'),
        "400": openapi.response('Invalid_ID_supplied'),
        "404": openapi.response('Expert_not_found')
      }
    }
  ),
  validate_miv_client,
  has_access('miv'),
  validate_admin_client,
  fetchExpertId,
  async (req, res) => {
    const params = {};
    req.query.expert = `expert/${req.query.expertId}`;
    for (const key in template.script.params) {
      if (req.query[key]) {
        params[key] = req.query[key];
      } else {
        params[key] = template.script.params[key];
      }
    }
    params.expert = req.query.expert;

    opts = {
      id: template.id,
      params
    };
    try {
      await expert.verify_template(template);
      const find = await expert.search(opts);
      //jq '.hits[0]["_inner_hits"][0]| {"@id","title":.name,"end_date":.dateTimeInterval.end.dateTime,"start_date":.dateTimeInterval.start.dateTime,"grant_amount":.totalAwardAmount,"sponsor_id":.sponsorAwardId,"sponsor_name":.assignedBy.name,"type":.["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"].name,"role_label":(.relatedBy[] | select(.inheres_in) | .["@type"])}' new.json
      let grants = [];
      if (find?.hits[0]) {
        for (const hit of find.hits[0]._inner_hits) {
          // Util function to ensure an array
          function ensureArray(value) {
            if (!Array.isArray(value)) {
              return [value];
            }
            return value;
          }
          // create a people array
          let people = [];
          if (hit.relatedBy) {
            hit.relatedBy.forEach((x) => {
              if (!x.inheres_in) {
                if (ensureArray(x['@type']).includes('CoPrincipalInvestigatorRole')) {
                  people.push({
                    '@id': x['@id'],
                    name: x.relates[0].name,
                    role: x['@type']
                  });
                }
              }
            });
          }
          grants.push({
            '@id': hit['@id'],
            title: hit.name,
            end_date: hit.dateTimeInterval.end.dateTime,
            start_date: hit.dateTimeInterval.start.dateTime,
            grant_amount: hit.totalAwardAmount,
            sponsor_id: hit.sponsorAwardId,
            sponsor_name: hit.assignedBy.name,
            type: hit['@type'],
            role_label: hit.relatedBy.find(x => x.inheres_in)['@type'],
            contributors: people
          });
        }
      }
      res.send({ "@graph": grants });
    } catch (err) {
      // Write the error message to the console
      console.error(err);
      res.status(400).send(err);
      // res.status(400).send('Invalid request - no likey');
    }
  }
);

router.get(
  '/raw_grants',
  // is_miv,
  fetchExpertId,
  async (req, res) => {
    const params = {};
    req.expert = `expert/${req.query.expertId}`;
    for (const key in template.script.params) {
      if (req.query[key]) {
        params[key] = req.query[key];
      } else {
        params[key] = template.script.params[key];
      }
    }
    params.expert = `expert/${req.query.expertId}`;

    opts = {
      id: template.id,
      params
    };
    try {
      await expert.verify_template(template);
      const find = await expert.search(opts);
      let grants = [];
      for (const hit of find.hits[0]._inner_hits) {
        grants.push(hit);
      }
      res.send(grants);
    } catch (err) {
      // Write the error message to the console
      console.error(err);
      res.status(400).send(err);
      // res.status(400).send('Invalid request - no likey');
    }
  }
);

module.exports = router;
