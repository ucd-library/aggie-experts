const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/family_prefix.json');
const {config} = require('@ucd-lib/fin-service-utils');

const experts = new ExpertModel();

const { openapi, is_user } = require('../middleware.js')

function browse_valid_path(options={}) {
  const def = {
    "description": "Browse a list of experts",
    "parameters": [],
  };

  (options.parameters || []).forEach((param) => {
    def.parameters.push(openapi.parameters(param));
  });

  delete options.parameters;

  return openapi.validPath({...def, ...options});
}

function browse_valid_path_error(err, req, res, next) {
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
  browse_valid_path(
    {
      description: "Returns counts for experts A - Z, or if sending query param p={letter}, will return results for experts with last names of that letter",
      parameters: ['p', 'page', 'size'],
      responses: {
        "200": openapi.response('Browse'),
        "400": openapi.response('Invalid_request')
      }
    }
  ),
  browse_valid_path_error,
  async (req, res) => {
  const params = {
    size: 25
  };
  ["size","page","p"].forEach((key) => {
    if (req.query[key]) { params[key] = req.query[key]; }
  });

  if (params.p) {
    const opts = {
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
