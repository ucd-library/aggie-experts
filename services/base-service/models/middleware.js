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
      Parameters: {
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
      },
      "Responses": {
        "Expert": {
          "description": "The expert",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Expert"
              }
            }
          }
        },
        "Expert_not_found": {
          "description": "Expert not found"
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
  });

openapi.response(
  'Expert',
  {
    "description": "The expert",
    "content": {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/Expert"
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
