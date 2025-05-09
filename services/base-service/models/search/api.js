const router = require('express').Router();
const BaseModel = require('../base/model.js');
const ExpertModel = require('../expert/model.js');
const GrantModel = require('../grant/model.js');
const WorkModel = require('../work/model.js');
const utils = require('../utils.js')
const complete = require('./template/complete.js');
const base = new BaseModel();
const experts = new ExpertModel();
const grants = new GrantModel();
const works = new WorkModel();

const {config} = require('@ucd-lib/fin-service-utils');

const { openapi, public_or_is_user } = require('../middleware/index.js')

function search_valid_path(options={}) {
  const def = {
    "description": "Search of experts and grants",
    "parameters": [],
  };

  (options.parameters || []).forEach((param) => {
    def.parameters.push(openapi.parameters(param));
  });

  delete options.parameters;

  return openapi.validPath({...def, ...options});
}

function search_valid_path_error(err, req, res, next) {
  return res.status(err.status).json({
    error: err.message,
    validation: err.validationErrors,
    schema: err.validationSchema
  })
}

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
router.use(openapi);

router.get(
  '/',
  public_or_is_user,
  search_valid_path(
    {
      description: "Returns matching search results, including the number of matching works and grants",
      parameters: ['p', 'page', 'size',
                   '@type', 'type', 'status','availability','expert',
                   'q', 'min_score', 'min_nested_score'
                  ],
      responses: {
        "200": openapi.response('Search'),
        "400": openapi.response('Invalid_request')
      }
    }
  ),
  search_valid_path_error,
  async (req, res) => {
    const params = {
      "@type":['expert','grant','work'],
      "q": "",
      "size": 10,
      "min_nested_score": 1,
      "min_score": 1,
      "page": 1,
      index: []
    };
    console.log('query',req.query);
    ["p","inner_hits_size","size","page","q",
     "min_score","min_nested_score"].forEach((key) => {
      if (req.query[key]) { params[key] = req.query[key]; }
    });
    // if the user is not logged in, we need to set the default
    if (params.size > 100) {
      res.status(400).json({ error: 'Size exceeds limit' });
    }

    if (req?.query.availability) {
      params.availability = req.query.availability.split(',');
    }
    if (req?.query.expert) {
      params.expert = req.query.expert.split(',');
    }
    if (req?.query.status) {
      params.status = req.query.status.split(',');
    }
    if (req?.query["@type"]) {
      params["@type"] = req.query["@type"].split(',');
    }
    if (req?.query.type) {
      params.type = req.query.type.split(',');
    }
    if ( ! params.q ) {
      res.status(400).json({ error: 'Missing required query parameter "q"' });
    }

    const typeToIndex = {
      expert: experts.readIndexAlias,
      grant: grants.readIndexAlias,
      work: works.readIndexAlias,
    };
    for (const t of params["@type"]) {
      const indexAlias = typeToIndex[t];
      if (!indexAlias) {
        return res.status(400).json({ error: 'Invalid type' });
      }
      params.index.push(indexAlias);
    }
    opts = {
      id: complete.id,
      explain: true, // TODO get setting from .env to enable/disable the extra explain response?
      params
    };
    try {
      await experts.verify_template(complete);
      const find = await base.search(opts);      
      // Now remove type filters, research
      delete params["@type"];
      delete params.status;
      delete params.type;
      const global = await base.search(
        { id: complete.id,
          params: {
            ...opts.params,
            size: 0,
            index: [experts.readIndexAlias,
                    grants.readIndexAlias,
                    works.readIndexAlias]
          }
        });
      find.global_aggregations = global.aggregations;
      res.send(find);
    } catch (err) {
      res.status(400).send('Invalid request');
    }
  });

module.exports = router;
