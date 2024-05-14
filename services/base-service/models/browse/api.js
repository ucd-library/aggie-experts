const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/family_prefix.json');
const {config} = require('@ucd-lib/fin-service-utils');

const experts = new ExpertModel();

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
    description: 'The Browse API returns a list of experts.',
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
      url: `${config.server.url}/api/browse`
    }
  ],
  tags: [
    {
      name: 'browse',
      description: 'Browse Expert Information'
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
      "description": "Returns counts for experts A - Z, or if sending query param p={letter}, will return results for experts with last names of that letter",
      "parameters": [
        {
          "in": "query",
          "name": "p",
          "description": "The letter the experts last name starts with",
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
              "total": {
                "type": "integer"
              },
              "hits": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "contactInfo": {
                      "type": "object",
                      "properties": {
                        "hasURL": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "@type": {
                                "type": "array",
                                "items": {
                                  "type": "string"
                                }
                              },
                              "@id": {
                                "type": "string"
                              },
                              "url": {
                                "type": "string"
                              },
                              "name": {
                                "type": "string"
                              },
                              "rank": {
                                "type": "integer"
                              }
                            }
                          }
                        },
                        "hasEmail": {
                          "type": "string"
                        },
                        "hasName": {
                          "type": "object",
                          "properties": {
                            "given": {
                              "type": "string"
                            },
                            "@type": {
                              "type": "string"
                            },
                            "pronouns": {
                              "type": "string"
                            },
                            "@id": {
                              "type": "string"
                            },
                            "family": {
                              "type": "string"
                            }
                          }
                        },
                        "name": {
                          "type": "string"
                        },
                        "hasTitle": {
                          "type": "object",
                          "properties": {
                            "@type": {
                              "type": "string"
                            },
                            "name": {
                              "type": "string"
                            },
                            "@id": {
                              "type": "string"
                            }
                          }
                        },
                        "hasOrganizationalUnit": {
                          "type": "object",
                          "properties": {
                            "name": {
                              "type": "string"
                            },
                            "@id": {
                              "type": "string"
                            }
                          }
                        }
                      }
                    },
                    "name": {
                      "type": "string"
                    },
                    "@id": {
                      "type": "string"
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
