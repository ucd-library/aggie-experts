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

function subselect(req, res, next) {
  try {
    let params= {
      'is-visible': true
    };
    if (req.query["is-visible"]) {
      params[is-visible] = req.query["is-visible"];
    }

    // only allow no-sanitize if they are an admin or the expert
    let expertId = `${req.params.expertId}`;
    params.admin = req.user?.roles?.includes('admin') || expertId === req?.user?.attributes?.expertId;

    res.thisDoc = model.subselect(res.thisDoc, params);
    next();
  } catch (e) {
    res.status(e.status || 500).json({error:e.message});
  }
}

// not sure we should include this in the API
//router.use(openapi);

browse_endpoint(router,model);
item_endpoint(router,model,subselect);

module.exports = router;
