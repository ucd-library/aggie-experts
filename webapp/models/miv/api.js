// Routes for the MIV API
const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/miv_grants.json');
const expert = new ExpertModel();

const { openapi, has_access, fetchExpertId } = require('../middleware/index.js')

router.get(
  '/user',
  has_access('miv'),
  // is_miv,
  fetchExpertId,
  async (req, res) => {
    const expertId = req.expertId;
    try {
      res.send(expertId);
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
    }
  }
);

function miv_valid_path(options = {}) {
  const def = {
    "description": "A JSON array an expert's grants",
    "parameters": [],
  };

//   (options.parameters || []).forEach((param) => {
//     def.parameters.push(openapi.parameters(param));
//   });

//   delete options.parameters;

  return openapi.validPath({ ...def, ...options });
}

function generateGrantFormattedDate() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(now.getTime() - tzOffsetMs);
  return localDate.toISOString().split('T')[0];
}

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
// router.use(openapi);

const path = require('path');

router.get('/', (req, res) => {
  // Send the pre-made swagger.json file
  // res.sendFile(path.join(__dirname, 'swagger.json'));
  res.redirect('/api/miv/openapi.json');
});


router.get(
  '/grants',
  miv_valid_path(
    {
      description: "Returns a JSON array of an expert's grants. One of 'email', 'ucdPersonUUID', or 'iamId' must be provided to identify the expert. The 'until' date defaults to today if not provided.",
      parameters: ['since', 'until', 'email', 'ucdPersonUUID', 'iamId'],
      responses: {
        "200": openapi.response('Successful_operation'),
        "400": openapi.response('Invalid_ID_supplied'),
        "404": openapi.response('Expert_not_found')
      }
    }
  ),
  has_access('miv'),
  fetchExpertId,
  async (req, res) => {
    const params = {};

    // default to today unless an until date is provided to filter results
    const until = req.query.until || generateGrantFormattedDate();
    
    for (const key in template.script.params) {
      if (req.query[key]) {
        params[key] = req.query[key];
      } else {
        params[key] = template.script.params[key];
      }
    }
    
    // Override with actual expert ID (Express 5: can't mutate req.query)
    params.expert = `expert/${req.expertId}`;
    params.until = until;

    opts = {
      id: template.id,
      params
    };

    try {
      await expert.verify_template(template);
      const find = await expert.search(opts);
      //jq '.hits[0]["_inner_hits"][0]| {"@id","title":.name,"end_date":.dateTimeInterval.end.dateTime,"start_date":.dateTimeInterval.start.dateTime,"grant_amount":.totalAwardAmount,"sponsor_id":.sponsorAwardId,"sponsor_name":.assignedBy.name,"type":.["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"].name,"role_label":(.relatedBy[] | select(.inheres_in) | .["@type"])}' new.json

      let grants = [];
      let expertId = find?.hits?.[0]?.['@id'] || '';
      if (find?.hits[0]) {
        for (const hit of find.hits[0]._inner_hits) {
          // Util function to ensure an array
          function ensureArray(value) {
            if (!Array.isArray(value)) {
              return [value];
            }
            return value;
          }

          // create a people array
          let people = [];
          if (hit.relatedBy) {
            hit.relatedBy.forEach((x) => {
              // filter to only other experts
              // Require @type to skip dangling {@id} stubs left over from
              // harvest-time #roleof_ drops.
              if( ( !x.inheres_in || x.inheres_in !== expertId ) && x['@type'] ) {
                let name = x.name || '';
                if( Array.isArray(name) ) name = name[0] || '';
                name = name.replace(/\b(?:COPI|PI):\s*/gi, '').trim();

                if (ensureArray(x['@type']).includes('PrincipalInvestigatorRole')) {
                  people.push({
                    '@id': x['@id'],
                    name,
                    role: 'PrincipalInvestigatorRole'
                  });
                } else if (ensureArray(x['@type']).includes('CoPrincipalInvestigatorRole')) {
                  people.push({
                    '@id': x['@id'],
                    name,
                    role: 'CoPrincipalInvestigatorRole'
                  });
                }
              }
            });
          }

          let role_label = hit.relatedBy?.find(x => x.inheres_in === expertId && x.relates.includes(expertId))?.['@type'] || '';

          // trim to just the name
          hit.name = (hit.name || '').split('§')?.[0]?.trim() || hit.name;

          grants.push({
            '@id': hit['@id'],
            title: hit.name,
            end_date: hit.dateTimeInterval.end.dateTime,
            start_date: hit.dateTimeInterval.start.dateTime,
            grant_amount: hit.totalAwardAmount,
            sponsor_id: hit.sponsorAwardId,
            sponsor_name: hit.assignedBy.name,
            type: hit['@type'],
            role_label,
            contributors: people
          });
        }
      }
      res.send({ "@graph": grants });
    } catch (err) {
      // Write the error message to the console
      console.error(err);
      res.status(400).send(err);
      // res.status(400).send('Invalid request - no likey');
    }
  }
);

router.get(
  '/raw_grants',
  has_access('miv'),
  fetchExpertId,
  async (req, res) => {
    const params = {};
    
    // default to today unless an until date is provided to filter results
    const until = req.query.until || generateGrantFormattedDate();
    
    for (const key in template.script.params) {
      if (req.query[key]) {
        params[key] = req.query[key];
      } else {
        params[key] = template.script.params[key];
      }
    }
    
    // Override with actual expert ID (Express 5: can't mutate req.query)
    params.expert = `expert/${req.expertId}`;
    params.until = until;

    opts = {
      id: template.id,
      params
    };
    try {
      await expert.verify_template(template);
      const find = await expert.search(opts);
      let grants = [];
      if (find?.hits && find.hits[0] && Array.isArray(find.hits[0]._inner_hits)) {
        for (const hit of find.hits[0]._inner_hits) {
          // trim to just the name
          hit.name = (hit.name || '').split('§')?.[0]?.trim() || hit.name;
          grants.push(hit);
        }
      }
      res.send(grants);
    } catch (err) {
      // Write the error message to the console
      console.error(err);
      res.status(400).send(err);
      // res.status(400).send('Invalid request - no likey');
    }
  }
);

// OpenAPI JSON for this router (temporary manual doc; Express 5 breaks auto-generation)
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
            '@id': { type: 'string', description: 'The unique identifier for the expert.' },
            '@type': { type: 'array', items: { type: 'string' }, description: 'The type of the expert.' },
            rank: { type: 'integer', description: 'The rank of the expert.' },
            name: { type: 'string', description: 'The name of the expert.' },
            url: { type: 'string', format: 'url', description: 'The URL related to the expert.' },
            hasEmail: { type: 'string', format: 'email', description: 'The email address of the expert.' },
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
            roles: { type: 'array', items: { type: 'string' }, description: 'The roles of the expert.' }
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

module.exports = router;
