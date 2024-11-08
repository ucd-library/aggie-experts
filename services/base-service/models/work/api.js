const router = require('express').Router();
const { browse_endpoint, item_endpoint, openapi } = require('../middleware/index.js')
const { is_user, valid_path, valid_path_error } = require('../middleware/index.js')

const WorkModel = require('./model.js');
const model = new WorkModel();

openapi.schema('work',
  {
    type: 'object',
    properties: {
      "@id": { type: 'string' },
      "@type": { type: Array, items: { type: 'string' } },
    }
  });

openapi.response(
  'work',
  {
    "description": "work",
    "content": {
      "application/json": {
        "schema": openapi.schema('work')
      }
    }
  }
);


router.get(
  '/search',
  is_user,
  valid_path(
    {
      description: `Returns matching search results for ${model.name}s.`,
      parameters: ['q', 'page', 'size'],
      responses: {
        "200": openapi.response('Search'),
        "400": openapi.response('Invalid_request')
      }
    }
  ),
  valid_path_error,
  async (req, res) => {
    const template=model.search_template;
    delete(template.query);
    const params = {
      index: [ model.readIndexAlias ]
    };
    ["p","inner_hit_size","size","page","q"].forEach((key) => {
      if (req.query[key]) { params[key] = req.query[key]; }
    });

    opts = {
      id: template.id,
      params
    };
//    try {
      await model.verify_template(template);
      const find = await model.search(opts);
      res.send(find);
//    } catch (err) {
//      res.status(400).send('Invalid request');
//    }
  });


browse_endpoint(router,model);
item_endpoint(router,model);

module.exports = router;
