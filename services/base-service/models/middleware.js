const OpenAPI = require('@wesleytodd/openapi')
const {config, keycloak} = require('@ucd-lib/fin-service-utils');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

let AdminClient=null;

let MIVJWKSClient=null;

async function fetchExpertId (req, res, next) {
  if (req.query.email || req.query.ucdPersonUUID || req.query.iamId) {
    const token = await keycloak.getServiceAccountToken();
    AdminClient.accessToken = token
  }
  let user;
  try {
    if (req.query.email) {
      const email = req.query.email;
      user = await AdminClient.findByEmail(email);
    } else if (req.query.ucdPersonUUID) {
      const ucdPersonUUID = req.query.ucdPersonUUID;
      user = await AdminClient.findOneByAttribute(`ucdPersonUUID:${ucdPersonUUID}`);
    }
    else if (req.query.iamId) {
      const iamId = req.query.iamId;
      user = await AdminClient.findOneByAttribute(`iamId:${iamId}`);
    }
  } catch (err) {
    // console.error(err);
    return res.status(500).send({error: 'Error finding expert with ${req.query}'});
  }

  if (user && user?.attributes?.expertId) {
    const expertId = Array.isArray(user.attributes.expertId) ? user.attributes.expertId[0] : user.attributes.expertId;
    req.query.expertId = expertId;
    return next();
  } else {
    return res.status(404).send({error: `No expert found`});
  }
}

async function convertIds(req, res, next) {
  const id_array = req.params.ids.replace('ids=', '').split(',');

  const token = await keycloak.getServiceAccountToken();
  AdminClient.accessToken = token

  let user;

  req.query.expertIds = [];
  // for each id, get the expertId
  for (const theId of id_array) {
    try {
      //Split the id into the type and the id
      let idParts = theId.split(':');
      user = await AdminClient.findOneByAttribute(`${idParts[0]}:${idParts[1]}`);
    }
    catch (err) {
      // console.error(err);
    }

    if (user && user?.attributes?.expertId) {
      const expertId = Array.isArray(user.attributes.expertId) ? user.attributes.expertId[0] : user.attributes.expertId;
      req.query.expertIds.push(expertId);
    }
  }
  return next();
}

async function validate_admin_client(req, res, next) {
  if (! AdminClient) {
    const { ExpertsKcAdminClient } = await import('@ucd-lib/experts-api');
    const oidcbaseURL = config.oidc.baseUrl;
    const match = oidcbaseURL.match(/^(https?:\/\/[^\/]+)\/realms\/([^\/]+)/);

    if (match) {
      AdminClient = new ExpertsKcAdminClient(
        {
          baseUrl: match[1],
          realmName: match[2]
        }
      );
    } else {
      throw new Error(`Invalid oidc.baseURL ${oidcbaseURL}`);
    }
  }
  next();
}

async function validate_miv_client(req, res, next) {
  if (! MIVJWKSClient) {
    const { ExpertsKcAdminClient } = await import('@ucd-lib/experts-api');
    const oidcbaseURL = config.oidc.baseUrl;
    const match = oidcbaseURL.match(/^(https?:\/\/[^\/]+)\/realms\/([^\/]+)/);

    if (match) {
      MIVJWKSClient = await jwksClient({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${match[1]}/realms/aggie-experts-miv/protocol/openid-connect/certs`
      });
    } else {
      throw new Error(`Invalid oidc.baseURL ${oidcbaseURL}`);
    }
  }
  next();
}

function has_access(client) {

  return async function(req, res, next) {
    if (!req.user) {
      // Try Service Account
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'Token not provided' });
      }

      try {
        // Get the public key from the JWKS endpoint
        const key = await MIVJWKSClient.getSigningKey(jwt.decode(token, { complete: true }).header.kid);
        // Verify the token's signature using the public key
        const verifiedToken = jwt.verify(token, key.getPublicKey(), { algorithms: ['RS256'] });

        // Validate issuer
        if (verifiedToken.iss !== 'https://auth.library.ucdavis.edu/realms/aggie-experts-miv') {
          return res.status(401).json({ error: 'Invalid token issuer' });
        }

        // Validate audience
        if (verifiedToken.aud !== 'account') {
          return res.status(401).json({ error: 'Invalid token audience' });
        }

        // Validate expiration
        if (Date.now() >= verifiedToken.exp * 1000) {
          return res.status(401).json({ error: 'Token has expired' });
        }

        // Validate request source (optional)
        //if (req.hostname !== verifiedToken.clientHost) {
        //  return res.status(401).json({ error: 'Invalid request source' });
        //}

        // Custom authorization logic
        // Implement your own logic here based on token claims
        if (! verifiedToken?.resource_access?.[client]?.roles?.includes('access')) {
          return res.status(403).json({ error: 'No Access Role' });
        }
        // return res.status(401).send('Unauthorized');
        if (req.user?.roles?.includes('admin') || req.user?.roles?.includes(client)) {
          return next();
        }
        return next();
      }
      catch (error) {
        // console.error(error);
        return res.status(403).json({ error: 'Internal server error' });
      }
    }
  }
}


// Custom middleware to check Content-Type
function json_only(req, res, next) {
  const contentType = req.get('Content-Type');
  if (contentType.startsWith('application/json') || contentType.startsWith('application/ld+json')) {
    // Content-Type is acceptable
    return next();
  } else {
    // Content-Type is not acceptable
    res.status(400).json({ error: 'Invalid Content-Type. Only application/json or application/ld+json is allowed.' });
  }
}

function is_user(req, res, next) {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  return next();
}


function user_can_edit(req, res, next) {
  let expertId = `${req.params.expertId}`;
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  if (req.user?.roles?.includes('admin')) {
    return next();
  }
  if( expertId === req?.user?.attributes?.expertId ) {
    return next();
  }

  return res.status(403).send('Not Authorized');
}

function schema_error(err, req, res, next) {
  res.status(err.status).json({
    error: err.message,
    validation: err.validationErrors,
    schema: err.validationSchema
  })
}

function valid_path(options={}) {
  const def = {
    "description": "API Path",
    "parameters": []
  };

  // what would this do, overwritten below w/ ...options
//  (options.parameters || []).forEach((param) => {
//    def.parameters.push(openapi.parameters(param));
//  });

   return openapi.validPath({...def, ...options});
}

function valid_path_error(err, req, res, next) {
  return res.status(err.status).json({
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
        },
        status: {
          in: "query",
          name: "status",
          description: "Comma-separated search filter on grant status",
          required: false,
          schema: {
            type: "arary",
            items: {
              type: "string",
              enum: ["completed", "active"]
            }
          },
          style: "simple",
          explode: false
        },
        hasAvailability: {
          in: "query",
          name: "hasAvailability",
          description: "Comma-separated search filter on expert availability types",
          required: false,
          schema: {
            type: "arary",
            items: {
              type: "string",
              enum: ["collab","community","industry","media"]
            }
          },
          style: "simple",
          explode: false
        },
        type: {
            in: "query",
          name: "type",
          description: "Comma-separated list of items to return.",
          required: false,
          schema: {
            type: "array",
            items: {
              type: "string",
              enum: ["expert", "grant", "work"],
              default: "expert,grant"
            }
          },
          style: "simple",
          explode: false
        }
      },
      schemas: {
        Grant: {
          type: 'object'
        },
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
  'Grant',
  {
    "description": "Grant",
    "content": {
      "application/json": {
        "schema": openapi.schema('Grant')
      }
    }
  }
);

openapi.response(
  'not_found',
  {
    "description": "Resource not found"
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

// export this middleware functions
module.exports = {
  convertIds,
  fetchExpertId,
  has_access,
  is_user,
  json_only,
  openapi,
  schema_error,
  user_can_edit,
  validate_admin_client,
  validate_miv_client,
  valid_path,
  valid_path_error
};
