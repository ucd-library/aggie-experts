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
        email: 'aggie-experts@ucdavis.edu'
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
            type: 'uri',
            format: 'urlencoded',
            description: 'A unique identifier for an expert relationship'
          }
        },
        fakeId: {
          name: 'fakeId',
          in: 'query',
          required: true,
          schema: {
            type: 'string',
            format: 'nano(\\d{8})',
            description: 'A fake identifier for testing validation'
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
)

// export this middleware functions
module.exports = {
  json_only,
  user_can_edit,
  openapi,
  schema_error
};
