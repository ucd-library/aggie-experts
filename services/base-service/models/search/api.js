const router = require('express').Router();
const BaseModel = require('../base/model.js');
const ExpertModel = require('../expert/model.js');
const GrantModel = require('../grant/model.js');
const utils = require('../utils.js')
const template = require('./template/default.js');
const base = new BaseModel();
const experts = new ExpertModel();
const grants = new GrantModel();

const {config} = require('@ucd-lib/fin-service-utils');

const { openapi, is_user } = require('../middleware.js')

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
  is_user,
  search_valid_path(
    {
      description: "Returns matching search results for experts, including the number of matching works and grants",
      parameters: ['p', 'page', 'size', 'type','hasAvailability'],
      responses: {
        "200": openapi.response('Search'),
        "400": openapi.response('Invalid_request')
      }
    }
  ),
  search_valid_path_error,
  async (req, res) => {
    const params = {
      type:['expert','grant'],
      index: []
    };
    ["p","inner_hit_size","size","page","q"].forEach((key) => {
      if (req.query[key]) { params[key] = req.query[key]; }
    });

    if (req?.query.hasAvailability) {
      console.log('hasAvailability', req.query.hasAvailability);
      params.hasAvailability = req.query.hasAvailability.split(',');
    }
    if (req?.query.type) {
      params.type = req.query.type.split(',');
    }
    params.type.forEach((type) => {
      switch (type) {
      case 'expert':
        params.index.push(experts.readIndexAlias);
        break;
      case 'grant':
        params.index.push(grants.readIndexAlias);
        break;
      default:
        return res.status(400).json({error: 'Invalid type'});
        break;
      }
    });
    opts = {
      id: template.id,
      params
    };
    try {
      await experts.verify_template(template);
      const find = await base.search(opts);
      res.send(find);
    } catch (err) {
      res.status(400).send('Invalid request');
    }
  });

module.exports = router;
