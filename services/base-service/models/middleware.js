const OpenAPI = require('@wesleytodd/openapi')
const {config} = require('@ucd-lib/fin-service-utils');

// Custom middleware to check Content-Type
function json_only(req, res, next) {
  const contentType = req.get('Content-Type');
  if (contentType === 'application/json' || contentType === 'application/ld+json') {
    // Content-Type is acceptable
    return next();
  } else {
    // Content-Type is not acceptable
    res.status(400).json({ error: 'Invalid Content-Type. Only application/json or application/ld+json is allowed.' });
  }
}

function is_user(req,res,next) {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  return next();
}


function user_can_edit(req, res, next) {
  let expertId = `expert/${req.params.expertId}`;
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  if ( req.user?.roles?.includes('admin')) {
    return next();
  }

  if( expertId === req.user.expertId ) {
    return next();
  }

  return res.status(403).send('Not Authorized');
}

function schema_error (err, req, res, next) {
  res.status(err.status).json({
    error: err.message,
    validation: err.validationErrors,
    schema: err.validationSchema
  })
}

const openapi = OpenAPI(
  {
    openapi: '3.0.3',
    info: {
      title: 'Experts',
      description: 'The Experts API specifies updates to a particular expert. Publically available API endpoints can be used for access to an experts data.  The permissions of current user allow additional access to the data.',
      termsOfService: 'http://swagger.io/terms/',
      contact: {
        email: 'experts@ucdavis.edu'
       },
      license: {
        name: 'Apache 2.0',
        url: 'http://www.apache.org/licenses/LICENSE-2.0.html'
      },
      version: config.experts.version,
    },
    components: {
      parameters: {
        expertId: {
          name: 'expertId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'nano(\\d{8})',
            description: 'The unique identifier for the expert'
          }
        },
        relationshipId: {
          name: 'relationshipId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'urlencoded',
            description: 'A unique identifier for an expert relationship'
          }
        },
        p: {
          in: "query",
          name: "p",
          description: "The letter the experts last name starts with",
          required: false,
          schema: {
            type: "string"
          }
        },
        page: {
          in: "query",
          name: "page",
          description: "The pagination of results to return, defaults to 1",
          required: false,
          schema: {
            type: "integer"
          }
        },
        size: {
          in: "query",
          name: "size",
          description: "The number of results to return per page, defaults to 25",
          required: false,
          schema: {
            type: "integer"
          }
        }
      },
      schemas: {
        Expert: {
          type: 'object',
          properties: {
            '@id': {
              type: 'string',
              description: 'The unique identifier for the expert.',
            },
            '@type': {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'The type of the expert.',
            },
            'rank': {
              type: 'integer',
              description: 'The rank of the expert.',
            },
            'name': {
              type: 'string',
              description: 'The name of the expert.',
            },
            'url': {
              type: 'string',
              format: 'url',
              description: 'The URL related to the expert.',
            },
            'hasEmail': {
              type: 'string',
              format: 'email',
              description: 'The email address of the expert.',
            },
            'hasName': {
              type: 'object',
              properties: {
                '@id': {
                  type: 'string',
                  description: 'The unique identifier for the name.',
                },
                '@type': {
                  type: 'string',
                  description: 'The type of the name.',
                },
                'family': {
                  type: 'string',
                  description: 'The family name of the expert.',
                },
                'given': {
                  type: 'string',
                  description: 'The given name of the expert.',
                },
                'pronouns': {
                  type: 'string',
                  description: 'The pronouns of the expert.',
                },
              },
              required: ['@id', '@type', 'family', 'given', 'pronouns'],
            },
            'hasTitle': {
              type: 'object',
              properties: {
                '@id': {
                  type: 'string',
                  description: 'The unique identifier for the title.',
                },
                '@type': {
                  type: 'string',
                  description: 'The type of the title.',
                },
                'name': {
                  type: 'string',
                  description: 'The title of the expert.',
                },
              },
              required: ['@id', '@type', 'name'],
            },
            'hasOrganizationalUnit': {
              type: 'object',
              properties: {
                '@id': {
                  type: 'string',
                  description: 'The unique identifier for the organizational unit.',
                },
                'name': {
                  type: 'string',
                  description: 'The name of the organizational unit.',
                },
              },
              required: ['@id', 'name'],
            },
            'roles': {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'The roles of the expert.',
            },
          },
          required: ['@id', '@type', 'rank', 'name', 'url', 'hasEmail', 'hasName', 'hasTitle', 'hasOrganizationalUnit', 'roles'],
        },
        Relationship: {
          "type": "object",
          "properties": {
            "@id": {
              "type": "string"
            },
            "@type": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "@graph": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "@id": {
                    "type": "string"
                  },
                  "@type": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "is-visible": {
                    "type": "boolean"
                  },
                  "rank": {
                    "type": "integer",
                    "format": "int32"
                  },
                  "relates": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "_": {
                    "type": "object",
                    "properties": {
                      "event": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "timestamp": {
                            "type": "string",
                            "format": "date-time"
                          },
                          "updateType": {
                            "type": "array",
                            "items": {
                              "type": "string"
                            }
                          }
                        },
                        "required": ["id", "timestamp", "updateType"]
                      },
                      "updated": {
                        "type": "string",
                        "format": "date-time"
                      }
                    },
                    "required": ["event", "updated"]
                  }
                },
                "required": ["@id", "@type", "is-visible", "rank", "relates", "_"]
              }
            },
            "roles": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": ["@id", "@type", "@graph", "roles"]
        },
        Browse: {
          type: 'object',
          properties: {
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
        },
        Search: {
          type: 'object',
          properties: {
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
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        }
      }
    },
    servers: [
      {
        url: `${config.server.url}/api/expert`
      }
    ],
    tags: [
      {
        name: 'expert',
        description: 'Expert Information'
      }
    ]
  }
);

openapi.response(
  'Expert',
  {
    "description": "The expert",
    "content": {
      "application/json": {
        "schema": openapi.schema('Expert')
      }
    }
  }
);

openapi.response(
  'Expert_not_found',
  {
    "description": "Expert not found"
  }
);

openapi.response(
  'Expert_deleted',
  {
    "description": "Expert deleted"
  }
);

openapi.response(
  'No_content',
  {
    "description": "No Content"
  }
);

openapi.response(
  'Relationship',
  {
    "description": "The relationship",
    "content": {
      "application/json": {
        "schema": openapi.schema('Relationship')
      }
    }
  }
);

openapi.response(
  'Relationship_not_found',
  {
    "description": "Relationship not found"
  }
);

openapi.response(
  'Browse',
  {
    "description": "The list of experts",
    "content": {
      "application/json": {
        "schema": openapi.schema('Browse')
      }
    }
  }
);

openapi.response(
  'Invalid_request',
  {
    "description": "Invalid request"
  }
);

openapi.response(
  'Search',
  {
    "description": "The list of search results",
    "content": {
      "application/json": {
        "schema": openapi.schema('Search')
      }
    }
  }
);

openapi.response(
  'Successful_operation',
  {
    "description": "Successful operation"
  }
);

openapi.response(
  'Invalid_ID_supplied',
  {
    "description": "Invalid ID supplied"
  }
);

openapi.requestBodies(
  'Relationship_patch',
  {
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "properties": {
            "@id": {
              "type": "string"
            },
            "visible": {
              "type": 'boolean'
            },
            "grant": {
              "type": 'boolean'
            }
          }
        }
      }
    }
  }
);

openapi.requestBodies(
  'Expert_patch',
  {
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "properties": {
            "@id": {
              "type": "string"
            },
            "visible": {
              "type": 'boolean'
            }
          }
        }
      }
    }
  }
);

// export this middleware functions
module.exports = {
  json_only,
  user_can_edit,
  openapi,
  schema_error
};
