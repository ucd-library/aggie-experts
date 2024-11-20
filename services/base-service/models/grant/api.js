const router = require('express').Router();

const { browse_endpoint, item_endpoint, openapi } = require('../middleware/index.js');

const GrantModel = require('./model.js');
const model = new GrantModel();

openapi.schema('grant',
  {
    type: 'object',
    properties: {
      "@id": { type: 'string' },
      "@type": { type: Array, items: { type: 'string' } },
    }
  });


openapi.response(
  'grant',
  {
    "description": "grant",
    "content": {
      "application/json": {
        "schema": openapi.schema('grant')
      }
    }
  }
);

// not sure we should include this in the API
//router.use(openapi);

browse_endpoint(router,model);
item_endpoint(router,model);

module.exports = router;
