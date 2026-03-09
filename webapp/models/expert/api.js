// const path = require('path');
// const express = require('express');
const router = require('express').Router();
// const {dataModels, logger} = require('@ucd-lib/fin-service-utils');
const ExpertModel = require('./model.js');
// const {defaultEsApiGenerator} = dataModels;
// const md5 = require('md5');
// const { logger } = require('@ucd-lib/fin-service-utils');
const model = new ExpertModel();

const { browse_endpoint, item_endpoint } = require('../middleware/index.js');
const { openapi, json_only, user_can_edit, public_or_is_user } = require('../middleware/index.js')

function subselect(req, res, next) {
  try {
    // parse params
    let params = Object.assign({}, req.params || {}, req.query || {}, req.body || {});
    if( params.options ) {
      params = Object.assign(params, JSON.parse(params.options));
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

// OpenAPI JSON for this router
router.get('/openapi.json', (req, res) => {
  // Short-term patch: serve a static, stable OpenAPI document.
  res.type('application/json').json({
    openapi: '3.0.3',
    info: {
      title: 'Experts',
      version: '3.3.0',
      description: 'The Experts API specifies updates to a particular expert. Publically available API endpoints can be used for access to an experts data.  The permissions of current user allow additional access to the data.',
      termsOfService: 'http://swagger.io/terms/',
      contact: {
        email: 'experts@ucdavis.edu'
      },
      license: {
        name: 'Apache 2.0',
        url: 'http://www.apache.org/licenses/LICENSE-2.0.html'
      }
    },
    components: {
      parameters: {
        expert: {
          in: 'query',
          name: 'expert',
          description: 'Comma-separated search filter on experts',
          required: false,
          schema: {
            type: 'array'
          },
          style: 'simple',
          explode: false
        },
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
        email: {
          in: 'query',
          name: 'email',
          description: 'Filter grants by email',
          required: false,
          schema: {
            type: 'string'
          }
        },
        ucdPersonUUID: {
          in: 'query',
          name: 'ucdPersonUUID',
          description: 'Filter grants by UCD Person UUID',
          required: false,
          schema: {
            type: 'string'
          }
        },
        iamId: {
          in: 'query',
          name: 'iamId',
          description: 'Filter grants by IAM ID',
          required: false,
          schema: {
            type: 'string'
          }
        },
        since: {
          in: 'query',
          name: 'since',
          description: 'Filter grants starting from this date (inclusive).',
          required: false,
          schema: {
            type: 'string',
            format: 'date',
            pattern: '^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$',
            example: '2010-01-01'
          }
        },
        until: {
          in: 'query',
          name: 'until',
          description: 'Filter grants up to this date (inclusive). Defaults to today if not provided.',
          required: false,
          schema: {
            type: 'string',
            format: 'date',
            pattern: '^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$',
            example: '2030-12-31'
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
          in: 'query',
          name: 'p',
          description: 'The letter the experts last name starts with',
          required: false,
          schema: {
            type: 'string'
          }
        },
        page: {
          in: 'query',
          name: 'page',
          description: 'The pagination of results to return, defaults to 1',
          required: false,
          schema: {
            type: 'integer'
          }
        },
        q: {
          in: 'query',
          name: 'q',
          description: 'Text query to search for',
          required: false,
          schema: {
            type: 'string'
          }
        },
        size: {
          in: 'query',
          name: 'size',
          description: 'The number of results to return per page, defaults to 25',
          required: false,
          schema: {
            type: 'integer'
          }
        },
        status: {
          in: 'query',
          name: 'status',
          description: 'Comma-separated search filter on grant status',
          required: false,
          schema: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['completed', 'active']
            }
          },
          style: 'simple',
          explode: false
        },
        type: {
          in: 'query',
          name: 'type',
          description: 'Comma-separated list of citation-types to return. From https://github.com/Juris-M/schema/blob/master/csl-types.rnc',
          required: false,
          schema: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'article',
                'article-journal',
                'article-magazine',
                'article-newspaper',
                'bill',
                'book',
                'broadcast',
                'chapter',
                'dataset',
                'entry',
                'entry-dictionary',
                'entry-encyclopedia',
                'figure',
                'graphic',
                'interview',
                'legal_case',
                'legislation',
                'manuscript',
                'map',
                'motion_picture',
                'musical_score',
                'pamphlet',
                'paper-conference',
                'patent',
                'personal_communication',
                'post',
                'post-weblog',
                'report',
                'review',
                'review-book',
                'song',
                'speech',
                'thesis',
                'treaty',
                'webpage'
              ]
            }
          },
          style: 'simple',
          explode: false
        },
        availability: {
          in: 'query',
          name: 'availability',
          description: 'Comma-separated search filter on expert availability types',
          required: false,
          schema: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['community partnerships', 'collaborative projects', 'industry Projects', 'media enquiries']
            }
          },
          style: 'simple',
          explode: false
        },
        '@type': {
          in: 'query',
          name: '@type',
          description: 'Comma-separated list of item @types to return.',
          required: false,
          schema: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['expert', 'grant', 'work'],
              default: 'expert,grant,work'
            }
          },
          style: 'simple',
          explode: false
        },
        dateFrom: {
          in: 'query',
          name: 'dateFrom',
          description: 'Filter results starting from this date (inclusive). A 4-digit year (YYYY) will automatically expand to the first day of that year (YYYY-01-01).',
          required: false,
          schema: {
            type: 'string',
            format: 'date',
            pattern: '^[0-9]{4}(-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01]))?$',
            example: '2017-01-01'
          }
        },
        dateTo: {
          in: 'query',
          name: 'dateTo',
          description: 'Filter results up to this date (inclusive). A 4-digit year (YYYY) will automatically expand to the last day of that year (YYYY-12-31).',
          required: false,
          schema: {
            type: 'string',
            format: 'date',
            pattern: '^[0-9]{4}(-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01]))?$',
            example: '2023-12-31'
          }
        }
      },
      schemas: {
        expert: {
          type: 'object',
          properties: {
            '@id': {
              type: 'string',
              description: 'The unique identifier for the expert.'
            },
            '@type': {
              type: 'array',
              items: { type: 'string' },
              description: 'The type of the expert.'
            },
            rank: {
              type: 'integer',
              description: 'The rank of the expert.'
            },
            name: {
              type: 'string',
              description: 'The name of the expert.'
            },
            url: {
              type: 'string',
              format: 'url',
              description: 'The URL related to the expert.'
            },
            hasEmail: {
              type: 'string',
              format: 'email',
              description: 'The email address of the expert.'
            },
            hasName: {
              type: 'object',
              properties: {
                '@id': { type: 'string', description: 'The unique identifier for the name.' },
                '@type': { type: 'string', description: 'The type of the name.' },
                family: { type: 'string', description: 'The family name of the expert.' },
                given: { type: 'string', description: 'The given name of the expert.' },
                pronouns: { type: 'string', description: 'The pronouns of the expert.' }
              },
              required: ['@id', '@type', 'family', 'given', 'pronouns']
            },
            hasTitle: {
              type: 'object',
              properties: {
                '@id': { type: 'string', description: 'The unique identifier for the title.' },
                '@type': { type: 'string', description: 'The type of the title.' },
                name: { type: 'string', description: 'The title of the expert.' }
              },
              required: ['@id', '@type', 'name']
            },
            hasOrganizationalUnit: {
              type: 'object',
              properties: {
                '@id': { type: 'string', description: 'The unique identifier for the organizational unit.' },
                name: { type: 'string', description: 'The name of the organizational unit.' }
              },
              required: ['@id', 'name']
            },
            roles: {
              type: 'array',
              items: { type: 'string' },
              description: 'The roles of the expert.'
            }
          },
          required: ['@id', '@type', 'rank', 'name', 'url', 'hasEmail', 'hasName', 'hasTitle', 'hasOrganizationalUnit', 'roles']
        },
        Relationship: {
          type: 'object',
          properties: {
            '@id': { type: 'string' },
            '@type': { type: 'array', items: { type: 'string' } },
            '@graph': {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  '@id': { type: 'string' },
                  '@type': { type: 'array', items: { type: 'string' } },
                  'is-visible': { type: 'boolean' },
                  rank: { type: 'integer', format: 'int32' },
                  relates: { type: 'array', items: { type: 'string' } },
                  _: {
                    type: 'object',
                    properties: {
                      event: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          timestamp: { type: 'string', format: 'date-time' },
                          updateType: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['id', 'timestamp', 'updateType']
                      },
                      updated: { type: 'string', format: 'date-time' }
                    },
                    required: ['event', 'updated']
                  }
                },
                required: ['@id', '@type', 'is-visible', 'rank', 'relates', '_']
              }
            },
            roles: { type: 'array', items: { type: 'string' } }
          },
          required: ['@id', '@type', '@graph', 'roles']
        },
        Browse: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            hits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  contactInfo: {
                    type: 'object',
                    properties: {
                      hasURL: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            '@type': { type: 'array', items: { type: 'string' } },
                            '@id': { type: 'string' },
                            url: { type: 'string' },
                            name: { type: 'string' },
                            rank: { type: 'integer' }
                          }
                        }
                      },
                      hasEmail: { type: 'string' },
                      hasName: {
                        type: 'object',
                        properties: {
                          given: { type: 'string' },
                          '@type': { type: 'string' },
                          pronouns: { type: 'string' },
                          '@id': { type: 'string' },
                          family: { type: 'string' }
                        }
                      },
                      name: { type: 'string' },
                      hasTitle: { type: 'object', properties: { '@type': { type: 'string' }, name: { type: 'string' }, '@id': { type: 'string' } } },
                      hasOrganizationalUnit: { type: 'object', properties: { name: { type: 'string' }, '@id': { type: 'string' } } }
                    }
                  },
                  name: { type: 'string' },
                  '@id': { type: 'string' }
                }
              }
            }
          }
        },
        Search: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            hits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  contactInfo: {
                    type: 'object',
                    properties: {
                      hasEmail: { type: 'string' },
                      hasName: {
                        type: 'object',
                        properties: {
                          given: { type: 'string' },
                          '@type': { type: 'string' },
                          '@id': { type: 'string' },
                          family: { type: 'string' }
                        }
                      },
                      name: { type: 'string' },
                      hasTitle: { type: 'object', properties: { '@type': { type: 'string' }, name: { type: 'string' }, '@id': { type: 'string' } } },
                      hasOrganizationalUnit: { type: 'object', properties: { name: { type: 'string' }, '@id': { type: 'string' } } }
                    }
                  },
                  '@type': { type: 'string' },
                  name: { type: 'string' },
                  '@id': { type: 'string' },
                  _inner_hits: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        volume: { type: 'string' },
                        '@type': { type: 'array', items: { type: 'string' } },
                        author: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              given: { type: 'string' },
                              rank: { type: 'integer' },
                              '@id': { type: 'string' },
                              family: { type: 'string' }
                            }
                          }
                        },
                        'container-title': { type: 'string' },
                        ISSN: { type: 'string' },
                        abstract: { type: 'string' },
                        page: { type: 'string' },
                        title: { type: 'string' },
                        type: { type: 'string' },
                        issued: { type: 'string' },
                        status: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        work: {
          type: 'object',
          properties: {
            '@id': { type: 'string' },
            '@type': { items: { type: 'string' } }
          }
        },
        grant: {
          type: 'object',
          properties: {
            '@id': { type: 'string' },
            '@type': { items: { type: 'string' } }
          }
        }
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer'
        }
      },
      responses: {
        not_found: { description: 'Resource not found' },
        missing_id: { description: 'Request needs id' },
        forbidden: { description: 'Request is forbidden' },
        Expert: {
          description: 'The expert',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/expert' } } }
        },
        Expert_not_found: { description: 'Expert not found' },
        Expert_deleted: { description: 'Expert deleted' },
        No_content: { description: 'No Content' },
        Relationship: {
          description: 'The relationship',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Relationship' } } }
        },
        Relationship_not_found: { description: 'Relationship not found' },
        Browse: {
          description: 'The list of experts',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Browse' } } }
        },
        Invalid_request: { description: 'Invalid request' },
        Search: {
          description: 'The list of search results',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Search' } } }
        },
        Successful_operation: { description: 'Successful operation' },
        Invalid_ID_supplied: { description: 'Invalid ID supplied' },
        work: {
          description: 'work',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/work' } } }
        },
        grant: {
          description: 'grant',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/grant' } } }
        }
      }
    },
    servers: [{ url: 'https://experts.ucdavis.edu/api/expert' }],
    tags: [{ name: 'expert', description: 'Expert Information' }],
    paths: {
      '/api/search/': {
        get: {
          description: 'Returns matching search results, including the number of matching works and grants',
          parameters: [
            { $ref: '#/components/parameters/p' },
            { $ref: '#/components/parameters/page' },
            { $ref: '#/components/parameters/size' },
            { $ref: '#/components/parameters/@type' },
            { $ref: '#/components/parameters/type' },
            { $ref: '#/components/parameters/status' },
            { $ref: '#/components/parameters/availability' },
            { $ref: '#/components/parameters/expert' },
            { $ref: '#/components/parameters/dateFrom' },
            { $ref: '#/components/parameters/dateTo' }
          ],
          responses: {
            200: { $ref: '#/components/responses/Search' },
            400: { $ref: '#/components/responses/Invalid_request' }
          }
        }
      },
      '/api/expert/browse': {
        get: {
          description: 'Returns for undefined for  A - Z, or if sending query param p={letter}, will return results for undefined with last names of that letter',
          parameters: ['p', 'page', 'size'],
          responses: {
            200: { $ref: '#/components/responses/Browse' },
            400: { $ref: '#/components/responses/Invalid_request' }
          }
        }
      },
      '/api/expert/{expertId}/{relationshipId}': {
        patch: {
          description: 'Update an expert relationship by id',
          parameters: [
            { name: 'expertId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'relationshipId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    '@id': { type: 'string' },
                    visible: { type: 'boolean' },
                    grant: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            204: { $ref: '#/components/responses/No_content' },
            404: { $ref: '#/components/responses/Relationship_not_found' }
          }
        },
        delete: {
          description: 'Update an expert relationship by id',
          parameters: [
            { name: 'expertId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'relationshipId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            204: { $ref: '#/components/responses/No_content' },
            404: { $ref: '#/components/responses/Relationship_not_found' }
          }
        }
      },
      '/api/expert/{expertId}': {
        get: {
          description: 'Get all expert data by id',
          parameters: [{ name: 'expertId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              not_found: { description: 'Resource not found' },
              missing_id: { description: 'Request needs id' },
              forbidden: { description: 'Request is forbidden' },
              Expert: {
                description: 'The expert',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/expert' } } }
              },
              Expert_not_found: { description: 'Expert not found' },
              Expert_deleted: { description: 'Expert deleted' },
              No_content: { description: 'No Content' },
              Relationship: {
                description: 'The relationship',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Relationship' } } }
              },
              Relationship_not_found: { description: 'Relationship not found' },
              Browse: {
                description: 'The list of experts',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Browse' } } }
              },
              Invalid_request: { description: 'Invalid request' },
              Search: {
                description: 'The list of search results',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Search' } } }
              },
              Successful_operation: { description: 'Successful operation' },
              Invalid_ID_supplied: { description: 'Invalid ID supplied' },
              work: {
                description: 'work',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/work' } } }
              },
              grant: {
                description: 'grant',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/grant' } } }
              }
            },
            400: { $ref: '#/components/responses/missing_id' },
            403: { $ref: '#/components/responses/forbidden' },
            404: { $ref: '#/components/responses/not_found' }
          }
        },
        post: {
          description: 'Get an expert by id',
          parameters: [{ name: 'expertId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    'is-visible': { type: 'boolean' },
                    expert: { type: 'object', properties: { include: { type: 'boolean' } } },
                    grants: {
                      type: 'object',
                      properties: {
                        include: { type: 'boolean' },
                        page: { type: 'integer' },
                        size: { type: 'integer' },
                        exclude: { type: 'array', items: { type: 'string' } },
                        includeMisformatted: { type: 'boolean' },
                        sort: {
                          type: 'array',
                          items: { type: 'object', properties: { field: { type: 'string' }, sort: { type: 'string' }, type: { type: 'string' } } }
                        }
                      }
                    },
                    works: {
                      type: 'object',
                      properties: {
                        include: { type: 'boolean' },
                        page: { type: 'integer' },
                        size: { type: 'integer' },
                        exclude: { type: 'array', items: { type: 'string' } },
                        includeMisformatted: { type: 'boolean' },
                        sort: {
                          type: 'array',
                          items: { type: 'object', properties: { field: { type: 'string' }, sort: { type: 'string' }, type: { type: 'string' } } }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: { $ref: '#/components/responses/Expert' },
            404: { $ref: '#/components/responses/Expert_not_found' }
          }
        },
        patch: {
          description: 'Update an experts visibility by expert id',
          parameters: [{ name: 'expertId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    '@id': { type: 'string' },
                    visible: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: { 204: { $ref: '#/components/responses/No_content' } }
        },
        delete: {
          description: 'Delete an expert by id',
          parameters: [{ name: 'expertId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 204: { $ref: '#/components/responses/Expert_deleted' } }
        }
      },
      '/api/work/search': {
        get: {
          description: 'Returns matching search results for undefineds.',
          parameters: ['q', 'page', 'size'],
          responses: {
            200: { $ref: '#/components/responses/Search' },
            400: { $ref: '#/components/responses/Invalid_request' }
          }
        }
      },
      '/api/work/browse': {
        get: {
          description: 'Returns for undefined for  A - Z, or if sending query param p={letter}, will return results for undefined with last names of that letter',
          parameters: ['p', 'page', 'size'],
          responses: {
            200: { $ref: '#/components/responses/Browse' },
            400: { $ref: '#/components/responses/Invalid_request' }
          }
        }
      },
      '/api/work/{id}': {
        get: {
          description: 'Get a ${model.name} by id',
          parameters: [{ name: 'id', in: 'path', required: false, schema: { type: 'string' } }],
          responses: {
            200: {
              not_found: { description: 'Resource not found' },
              missing_id: { description: 'Request needs id' },
              forbidden: { description: 'Request is forbidden' },
              Expert: {
                description: 'The expert',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/expert' } } }
              },
              Expert_not_found: { description: 'Expert not found' },
              Expert_deleted: { description: 'Expert deleted' },
              No_content: { description: 'No Content' },
              Relationship: {
                description: 'The relationship',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Relationship' } } }
              },
              Relationship_not_found: { description: 'Relationship not found' },
              Browse: {
                description: 'The list of experts',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Browse' } } }
              },
              Invalid_request: { description: 'Invalid request' },
              Search: {
                description: 'The list of search results',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Search' } } }
              },
              Successful_operation: { description: 'Successful operation' },
              Invalid_ID_supplied: { description: 'Invalid ID supplied' },
              work: {
                description: 'work',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/work' } } }
              },
              grant: {
                description: 'grant',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/grant' } } }
              }
            },
            400: { $ref: '#/components/responses/missing_id' },
            403: { $ref: '#/components/responses/forbidden' },
            404: { $ref: '#/components/responses/not_found' }
          }
        }
      },
      '/api/grant/browse': {
        get: {
          description: 'Returns for undefined for  A - Z, or if sending query param p={letter}, will return results for undefined with last names of that letter',
          parameters: ['p', 'page', 'size'],
          responses: {
            200: { $ref: '#/components/responses/Browse' },
            400: { $ref: '#/components/responses/Invalid_request' }
          }
        }
      },
      '/api/grant/{id}': {
        get: {
          description: 'Get a ${model.name} by id',
          parameters: [{ name: 'id', in: 'path', required: false, schema: { type: 'string' } }],
          responses: {
            200: {
              not_found: { description: 'Resource not found' },
              missing_id: { description: 'Request needs id' },
              forbidden: { description: 'Request is forbidden' },
              Expert: {
                description: 'The expert',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/expert' } } }
              },
              Expert_not_found: { description: 'Expert not found' },
              Expert_deleted: { description: 'Expert deleted' },
              No_content: { description: 'No Content' },
              Relationship: {
                description: 'The relationship',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Relationship' } } }
              },
              Relationship_not_found: { description: 'Relationship not found' },
              Browse: {
                description: 'The list of experts',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Browse' } } }
              },
              Invalid_request: { description: 'Invalid request' },
              Search: {
                description: 'The list of search results',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Search' } } }
              },
              Successful_operation: { description: 'Successful operation' },
              Invalid_ID_supplied: { description: 'Invalid ID supplied' },
              work: {
                description: 'work',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/work' } } }
              },
              grant: {
                description: 'grant',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/grant' } } }
              }
            },
            400: { $ref: '#/components/responses/missing_id' },
            403: { $ref: '#/components/responses/forbidden' },
            404: { $ref: '#/components/responses/not_found' }
          }
        }
      },
      '/api/sitefarm/experts/{ids}': {
        get: {
          description: 'Returns a JSON array of expert profiles',
          parameters: [
            {
              name: 'ids',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: "A comma separated list of expert IDs. Ids are in the format of '{idType}:{Id}'. For example 'expertId:12345'"
            }
          ],
          responses: {
            200: { $ref: '#/components/responses/Successful_operation' },
            400: { $ref: '#/components/responses/Invalid_ID_supplied' },
            404: { $ref: '#/components/responses/Expert_not_found' }
          }
        }
      },
      '/api/miv/grants': {
        get: {
          description: "Returns a JSON array of an expert's grants. One of 'email', 'ucdPersonUUID', or 'iamId' must be provided to identify the expert. The 'until' date defaults to today if not provided.",
          parameters: [
            { $ref: '#/components/parameters/since' },
            { $ref: '#/components/parameters/until' },
            { $ref: '#/components/parameters/email' },
            { $ref: '#/components/parameters/ucdPersonUUID' },
            { $ref: '#/components/parameters/iamId' }
          ],
          responses: {
            200: { $ref: '#/components/responses/Successful_operation' },
            400: { $ref: '#/components/responses/Invalid_ID_supplied' },
            404: { $ref: '#/components/responses/Expert_not_found' }
          }
        }
      }
    }
  });
});

router.get('/', (req, res) => {
  res.redirect('/api/expert/openapi.json');
});

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
// NOTE: Disabled for now. Under Express 5 this middleware crashes with:
//   TypeError: Cannot read properties of undefined (reading 'fast_slash')
// in @wesleytodd/openapi/lib/generate-doc.js
// router.use(openapi);

browse_endpoint(router,model);

router.patch('/:expertId/availability',
  // expert_valid_path(
  //   {
  //     description: "Update an experts visibility by expert id",
  //     // requestBody: openapi.requestBodies('Expert_patch'),
  //     responses: {
  //       "204": openapi.response('No_content')
  //     }
  //   }
  // ),
  // expert_valid_path_error,
  user_can_edit,
  json_only,
  async (req, res, next) => {
    expertId = `expert/${req.params.expertId}`;
    let data = req.body;
    try {
      let resp = await model.patchAvailability(data, expertId);
      res.status(204).json();
    } catch(e) {
      next(e);
    }
  }
)


router.route(
  '/:expertId/:relationshipId'
).patch(
  // expert_valid_path(
  //   {
  //     description: "Update an expert relationship by id",
  //     // hack, in the validate.js makeValidator() func of the npm package,
  //     // it's looking for schema.requestBody.content to build from, and can't use the ref returned from openapi.requestBodies()
  //     requestBody: {
  //       "content": {
  //         "application/json": {
  //           "schema": {
  //             "type": "object",
  //             "properties": {
  //               "@id": {
  //                 "type": "string"
  //               },
  //               "visible": {
  //                 "type": 'boolean'
  //               },
  //               "grant": {
  //                 "type": 'boolean'
  //               }
  //             }
  //           }
  //         }
  //       }
  //     },
  //     responses: {
  //       "204": openapi.response('No_content'),
  //       "404": openapi.response('Relationship_not_found')
  //     }
  //   }
  // ),
  // expert_valid_path_error,
  user_can_edit,
  json_only,
  async (req, res, next) => {
    let expertId=`expert/${req.params.expertId}`
    let data = req.body;

    try {
      let resp;
      let role_model;
      if( data.grant ) {
        role_model = model.grantRole();
      } else {
        role_model = model.Authorship();
      }
      patched=await role_model.patch(data,expertId);
      res.status(204).json();
//      res.status(200).json({status: 'ok'});
    } catch(e) {
      next(e);
    }
  }
).delete(
  // expert_valid_path(
  //   {
  //     description: "Update an expert relationship by id",
  //     responses: {
  //       "204": openapi.response('No_content'),
  //       "404": openapi.response('Relationship_not_found')
  //     }
  //   }
  // ),
  // expert_valid_path_error,
  user_can_edit,
  async (req, res, next) => {
    // logger.info(`DELETE ${req.url}`);

    try {
      let expertId = `expert/${req.params.expertId}`;
      let id = req.params.relationshipId;

      await model.Authorship().delete(id, expertId);
      res.status(200).json({status: "ok"});
    } catch(e) {
      next(e);
    }
  }
);

function expert_valid_path(options={}) {
  // for parameters, if we let them auto build (from express route params), then they work..
  // but if we add a ref to the component by calling openapi.parameters('someId')..
  // then it duplicates and doesn't tie the auto built param to the ref param..

  const def = {
    "description": "Get an expert",
    "parameters": [
      // this duplicates with the auto built param
      // openapi.parameters('expertId'),

      // this works to override expertId from auto built param if needed
      // {
      //   name: 'expertId',
      //   in: 'path',
      //   required: true,
      //   schema: {
      //     type: 'number',
      //     format: 'nano(\\d{8})',
      //     description: 'The unique identifier for the expert'
      //   }
      // }

    //   {
    //     name: 'fakeId',
    //     in: 'path',
    //     required: true,
    //     schema: {
    //       type: 'number',
    //       description: 'A unique id to break validation'
    //     }
    //   }

      // interestingly, this fails to validate, even though required is true
      // so even if the ref param worked above, the validation doesn't seem to. so we may need to just let them auto build..
      // or explicitly define custom params when not using express route params
      // openapi.parameters('fakeId'),
    ]
  };

  return openapi.validPath({...def, ...options});
}

function expert_valid_path_error(err, req, res, next) {
  return res.status(err.status).json({
    error: err.message,
    validation: err.validationErrors,
    schema: err.validationSchema
  })
}

// this is taken from the middleware/index.js item_endpoint function
// just creating a simple route for now to return all expert graph data,
// optionally including "is-visible":false for admins/profile owner
// ?include=hidden&all
router.route(
  '/:expertId'
).get(
  // expert_valid_path(
  //   {
  //     description: "Get all expert data by id",
  //     responses: {
  //       "200": openapi.response(model.name),
  //       "400": openapi.response('missing_id'),
  //       "403": openapi.response('forbidden'),
  //       "404": openapi.response('not_found')
  //     }
  //   //   parameters: {
  //   //     "id": {
  //   //       "name": "id",
  //   //       "in": "path",
  //   //       "description": "identifier",
  //   //       "required": true,
  //   //       "schema": { "type": "string" }
  //   //     }
  //   //   }
  //   }
  //   ),
  public_or_is_user,
  // expert_valid_path_error,
  async (req, res, next) => {
    let expertId = `expert/${req.params.expertId}`;
    let includeHidden = req.query['include'] === 'hidden';
    let all = false;
    if( 'all' in req.query ) {
      all = true;
    }

    // only logged in user/admin can specify to include non-visible entries (using url param 'is-visible=include')
    // and (for now) only owner/admin can ask for the complete record (all grants/works, using url param 'all')
    let userCanEdit = req.user?.roles?.includes('admin') || expertId === req.user?.attributes?.expertId;
    let userLoggedIn = req.user;

    if( !userLoggedIn && !userCanEdit ) includeHidden = false;
    if( !userCanEdit && all ) all = false;

    let options = {
      'is-visible': !includeHidden,
      expert : { include : true },
      grants : { include : true },
      works : { include : true }
    };

    if( userCanEdit ) {
      options.admin = true;
    }

    if( !all ) {
      options.grants.page = 1;
      options.grants.size = 5;
      options.works.page = 1;
      options.works.size = 10;
    }

    try {
      res.thisDoc = await model.get(expertId);
      res.thisDoc = model.subselect(res.thisDoc, options);
      res.status(200).json(res.thisDoc);
    } catch (e) {
      return res.status(404).json(`${expertId} resource not found`);
    }
  }
)


router.route(
  '/:expertId'
).post(
  public_or_is_user,
  // expert_valid_path(
  //   {
  //     description: "Get an expert by id",
  //     requestBody: {
  //       "content": {
  //         "application/json": {
  //           "schema": {
  //             "type": "object",
  //             "properties": {
  //               "is-visible": {
  //                 "type": "boolean"
  //               },
  //               "expert": {
  //                 "type": "object",
  //                 "properties": {
  //                   "include": {
  //                     "type": "boolean"
  //                   }
  //                 }
  //               },
  //               "grants": {
  //                 "type": "object",
  //                 "properties": {
  //                   "include": {
  //                     "type": "boolean"
  //                   },
  //                   "page": {
  //                     "type": "integer"
  //                   },
  //                   "size": {
  //                     "type": "integer"
  //                   },
  //                   "exclude": {
  //                     "type": "array",
  //                     "items": {
  //                       "type": "string"
  //                     }
  //                   },
  //                   "includeMisformatted": {
  //                     "type": "boolean"
  //                   },
  //                   "sort": {
  //                     "type": "array",
  //                     "items": {
  //                       "type": "object",
  //                       "properties": {
  //                         "field": {
  //                           "type": "string"
  //                         },
  //                         "sort": {
  //                           "type": "string"
  //                         },
  //                         "type": {
  //                           "type": "string"
  //                         }
  //                       }
  //                     }
  //                   }
  //                 }
  //               },
  //               "works": {
  //                 "type": "object",
  //                 "properties": {
  //                   "include": {
  //                     "type": "boolean"
  //                   },
  //                   "page": {
  //                     "type": "integer"
  //                   },
  //                   "size": {
  //                     "type": "integer"
  //                   },
  //                   "exclude": {
  //                     "type": "array",
  //                     "items": {
  //                       "type": "string"
  //                     }
  //                   },
  //                   "includeMisformatted": {
  //                     "type": "boolean"
  //                   },
  //                   "sort": {
  //                     "type": "array",
  //                     "items": {
  //                       "type": "object",
  //                       "properties": {
  //                         "field": {
  //                           "type": "string"
  //                         },
  //                         "sort": {
  //                           "type": "string"
  //                         },
  //                         "type": {
  //                           "type": "string"
  //                         }
  //                       }
  //                     }
  //                   }
  //                 }
  //               }
  //             }
  //           }
  //         }
  //       }
  //     },
  //     responses: {
  //       "200": openapi.response('Expert'),
  //       "404": openapi.response('Expert_not_found')
  //     }
  //   }
  // ),
  // expert_valid_path_error,
  async (req, res, next) => {
    let expertId = `expert/${req.params.expertId}`;
    try {
      res.thisDoc = await model.get(expertId);
      next();
    } catch (e) {
      return res.status(404).json(`${req.path} resource not found`);
    }
  },
  subselect, // filter results
  (req, res) => {
    res.status(200).json(res.thisDoc);
  }
).patch(
  // expert_valid_path(
  //   {
  //     description: "Update an experts visibility by expert id",
  //     requestBody: {
  //       "content": {
  //         "application/json": {
  //           "schema": {
  //             "type": "object",
  //             "properties": {
  //               "@id": {
  //                 "type": "string"
  //               },
  //               "visible": {
  //                 "type": 'boolean'
  //               }
  //             }
  //           }
  //         }
  //       }
  //     },
  //     responses: {
  //       "204": openapi.response('No_content')
  //     }
  //   }
  // ),
  // expert_valid_path_error,
  user_can_edit,
  json_only,
  async (req, res, next) => {
    expertId = `expert/${req.params.expertId}`;
    let data = req.body;
    try {
      let resp;
      patched=await model.patch(data,expertId);
      res.status(204).json();
    } catch(e) {
      next(e);
    }
  }
).delete(
  // expert_valid_path(
  //   {
  //     description: "Delete an expert by id",
  //     responses: {
  //       "204": openapi.response('Expert_deleted')
  //     }
  //   }
  // ),
  // expert_valid_path_error,
  user_can_edit,
  async (req, res, next) => {
    try {
      let expertId = `expert/${req.params.expertId}`;
      await model.delete(expertId);
      res.status(204).json({status: "ok"});
    } catch(e) {
      next(e);
    }
  }
);

module.exports = router;
