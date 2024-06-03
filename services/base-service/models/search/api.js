const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/default.json');
const experts = new ExpertModel();
const {config} = require('@ucd-lib/fin-service-utils');

const openapi = require('@wesleytodd/openapi')

// This is destined for middleware.js
function is_user(req,res,next) {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  return next();
}

const oapi = openapi({
  openapi: '3.0.3',
  info: {
    title: 'Express',
    description: 'The Search API returns a list of experts.',
    version: '1.0.0',
    termsOfService: 'http://swagger.io/terms/',
    contact: {
      email: 'aggie-experts@ucdavis.edu'
    },
    license: {
      name: 'Apache 2.0',
      url: 'http://www.apache.org/licenses/LICENSE-2.0.html'
    },
    version: config.experts.version,
  },
  servers: [
    {
      url: `${config.server.url}/api/search`
    }
  ],
  tags: [
    {
      name: 'search',
      description: 'Search Expert Information'
    }
  ]
})

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
router.use(oapi);

router.get(
  '/',
  is_user,
  oapi.validPath(
    {
      "description": "Returns matching search results for experts, including the number of matching works and grants",
      "parameters": [
        {
          "in": "query",
          "name": "q",
          "description": "The search term",
          "required": false,
          "schema": {
            "type": "string"
          }
        },
        {
          "in": "query",
          "name": "page",
          "description": "The pagination of results to return, defaults to 1",
          "required": false,
          "schema": {
            "type": "integer"
          }
        },
        {
          "in": "query",
          "name": "size",
          "description": "The number of results to return per page, defaults to 25",
          "required": false,
          "schema": {
            "type": "integer"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "Successful operation",
          "content": {
            "application/json": {
              "total": { "type": "integer" },
              "hits": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "contactInfo": {
                      "type": "object",
                      "properties": {
                        "hasEmail": { "type": "string" },
                        "hasName": {
                          "type": "object",
                          "properties": {
                            "given": { "type": "string" },
                            "@type": { "type": "string" },
                            "@id": { "type": "string" },
                            "family": { "type": "string" }
                          }
                        },
                        "name": { "type": "string" },
                        "hasTitle": {
                          "type": "object",
                          "properties": {
                            "@type": { "type": "string" },
                            "name": { "type": "string" },
                            "@id": { "type": "string" }
                          }
                        },
                        "hasOrganizationalUnit": {
                          "type": "object",
                          "properties": {
                            "name": { "type": "string" },
                            "@id": { "type": "string" }
                          }
                        }
                      }
                    },
                    "@type": { "type": "string" },
                    "name": { "type": "string" },
                    "@id": { "type": "string" },
                    "_inner_hits": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "volume": { "type": "string" },
                          "@type": { "type": "array", "items": { "type": "string" } },
                          "author": {
                            "type": "array",
                            "items": {
                              "type": "object",
                              "properties": {
                                "given": { "type": "string" },
                                "rank": { "type": "integer" },
                                "@id": { "type": "string" },
                                "family": { "type": "string" }
                              }
                            }
                          },
                          "container-title": { "type": "string" },
                          "ISSN": { "type": "string" },
                          "abstract": { "type": "string" },
                          "page": { "type": "string" },
                          "title": { "type": "string" },
                          "type": { "type": "string" },
                          "issued": { "type": "string" },
                          "status": { "type": "string" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  ),
  async (req, res) => {
  const params = {};

  ["inner_hit_size","size","page","q"].forEach((key) => {
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
