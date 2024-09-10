const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/default.js');
const experts = new ExpertModel();
const {config} = require('@ucd-lib/fin-service-utils');

const { openapi, is_user } = require('../middleware.js')

function search_valid_path(options={}) {
  const def = {
    "description": "Search of experts",
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
      parameters: ['p', 'page', 'size'],
      responses: {
        "200": openapi.response('Search'),
        "400": openapi.response('Invalid_request')
      }
    }
  ),
  search_valid_path_error,
  async (req, res) => {
  const params = {};

  ["inner_hit_size","size","page","q","hasAvailability"].forEach((key) => {
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
