// Routes for the MIV API
const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/miv_grants.json');
const expert = new ExpertModel();

const { openapi, has_access, fetchExpertId } = require('../middleware/index.js')

router.get(
  '/user',
  has_access('miv'),
  // is_miv,
  fetchExpertId,
  async (req, res) => {
    const expertId = req.expertId;
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
    "parameters": [],
  };

//   (options.parameters || []).forEach((param) => {
//     def.parameters.push(openapi.parameters(param));
//   });

//   delete options.parameters;

  return openapi.validPath({ ...def, ...options });
}

function generateGrantFormattedDate() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(now.getTime() - tzOffsetMs);
  return localDate.toISOString().split('T')[0];
}

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
// router.use(openapi);

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
      description: "Returns a JSON array of an expert's grants. One of 'email', 'ucdPersonUUID', or 'iamId' must be provided to identify the expert. The 'until' date defaults to today if not provided.",
      parameters: ['since', 'until', 'email', 'ucdPersonUUID', 'iamId'],
      responses: {
        "200": openapi.response('Successful_operation'),
        "400": openapi.response('Invalid_ID_supplied'),
        "404": openapi.response('Expert_not_found')
      }
    }
  ),
  has_access('miv'),
  fetchExpertId,
  async (req, res) => {
    const params = {};

    // default to today unless an until date is provided to filter results
    const until = req.query.until || generateGrantFormattedDate();
    
    for (const key in template.script.params) {
      if (req.query[key]) {
        params[key] = req.query[key];
      } else {
        params[key] = template.script.params[key];
      }
    }
    
    // Override with actual expert ID (Express 5: can't mutate req.query)
    params.expert = `expert/${req.expertId}`;
    params.until = until;

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
                if (ensureArray(x['@type']).includes('PrincipalInvestigatorRole')) {
                  people.push({
                    '@id': x['@id'],
                    name: x.relates[0].name,
                    role: 'PrincipalInvestigatorRole'
                  });
                } else if (ensureArray(x['@type']).includes('CoPrincipalInvestigatorRole')) {
                  people.push({
                    '@id': x['@id'],
                    name: x.relates[0].name,
                    role: 'CoPrincipalInvestigatorRole'
                  });
                }
              }
            });
          }

          // trim to just the name
          hit.name = (hit.name || '').split('§')?.[0]?.trim() || hit.name;

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
  has_access('miv'),
  fetchExpertId,
  async (req, res) => {
    const params = {};
    
    // default to today unless an until date is provided to filter results
    const until = req.query.until || generateGrantFormattedDate();
    
    for (const key in template.script.params) {
      if (req.query[key]) {
        params[key] = req.query[key];
      } else {
        params[key] = template.script.params[key];
      }
    }
    
    // Override with actual expert ID (Express 5: can't mutate req.query)
    params.expert = `expert/${req.expertId}`;
    params.until = until;

    opts = {
      id: template.id,
      params
    };
    try {
      await expert.verify_template(template);
      const find = await expert.search(opts);
      let grants = [];
      if (find?.hits && find.hits[0] && Array.isArray(find.hits[0]._inner_hits)) {
        for (const hit of find.hits[0]._inner_hits) {
          // trim to just the name
          hit.name = (hit.name || '').split('§')?.[0]?.trim() || hit.name;
          grants.push(hit);
        }
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

// OpenAPI JSON for this router (temporary manual doc; Express 5 breaks auto-generation)
router.get('/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.3',
    info: openapi?.definition?.info || {
      title: 'MIV',
      version: '0.0.0',
      description: 'MIV API'
    },
    servers: openapi?.definition?.servers || [{ url: '/api/miv' }],
    components: openapi?.definition?.components || {},
    paths: {
      '/api/miv/user': {
        get: {
          description: 'Return expertId for a user identified via email/ucdPersonUUID/iamId (requires MIV access)',
          parameters: [
            { name: 'email', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'ucdPersonUUID', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'iamId', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            '200': { description: 'OK' },
            '400': { description: 'Bad request' },
            '401': { description: 'Unauthorized' },
            '403': { description: 'Forbidden' }
          }
        }
      },
      '/api/miv/grants': {
        get: {
          description: "Return a JSON array of an expert's grants.",
          parameters: [
            { name: 'since', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
            { name: 'until', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
            { name: 'email', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'ucdPersonUUID', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'iamId', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            '200': { description: 'OK' },
            '400': { description: 'Bad request' },
            '401': { description: 'Unauthorized' },
            '403': { description: 'Forbidden' }
          }
        }
      }
    }
  });
});

module.exports = router;
