const express = require('express');
const router = require('express').Router();
// const { config, keycloak, dataModels, logger } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');
const ExpertModel = require('../expert/model.js');
const template = require('./template/modified-date.js');
const expert = new ExpertModel();
const base = new BaseModel();
// const experts = new ExpertModel();

// const { defaultEsApiGenerator } = dataModels;
// const {config, keycloak} = require('@ucd-lib/fin-service-utils');
const md5 = require('md5');

const { openapi, json_only, has_access, fetchExpertId, convertIds } = require('../middleware/index.js')


function siteFarmFormat(req, res, next) {
  // This function will take the query return of expert data and format it for sitefarm

  var newArray = [];
  for (let i in res.doc_array) {
    // Expecting a single expert document
    let doc = res.doc_array[i];

    // Subselect to experts and their works - max return 5 works
    doc = expert.subselect(
      doc,
      {
        'is-visible' : true,
        expert : { include : true },
        grants : {
          include : false,
          exclude: [
            "totalAwardAmount"
          ],
          includeMisformattedd: false,
          sort: [
            {
              "field": "dateTimeInterval.end.dateTime",
              "sort": "desc",
              "type": "date"
            },
            {
              "field": "name",
              "sort": "asc",
              "type": "string"
            }
          ]
        },
        works : {
          include :true,
          page : 1,
          size : 5,
          includeMisformatted : false,
          sort : [
            {
              "field": "issued",
              "sort": "desc",
              "type": "year"
            },
            {
              "field": "title",
              "sort": "asc",
              "type": "string"
            } ]
        }
      } );

    let newDoc = {};

    newDoc["@id"] = doc["@id"];
    newDoc["publications"] = [];
    newDoc["contactInfo"] = doc.contactInfo || {};
    newDoc["contactInfo"].hasURL = []; // initialize to empty array
    // We need to dig down for the preferred contactInfo website list
    // We will grab the first website that is not preferred and has a rank of 20 indicating it is a website list
    let websites = doc["@graph"][0].contactInfo?.filter(c => (!c['isPreferred'] || c['isPreferred'] === false) && c['rank'] === 20 && c.hasURL);

    // ... but also grab all preferred contactInfo details
    for (let j = 0; j < doc["@graph"].length; j++) {
      if (doc["@graph"][j]["@type"].includes("Expert")) {
        if (doc["@graph"][j]["contactInfo"].isPreferred === true) {
          newDoc["contactInfo"] = doc["@graph"][j].contactInfo;
        }
      }
      // If the node is a Work, copy it to the publications array
      else if (doc["@graph"][j]["@type"].includes("Work")) {
        newDoc["publications"].push(doc["@graph"][j]);
      }
    }

    // Copy other Expert properties to the new document
    newDoc["orcidId"] = doc["@graph"][i].orcidId;
    newDoc["overview"] = doc["@graph"][i].overview;
    newDoc["researcherId"] = doc["@graph"][i].researcherId;
    newDoc["scopusId"] = doc["@graph"][i].scopusId;

    // Include the website list we filtered for above
    newDoc["contactInfo"].hasURL = websites.length > 0 && websites[0].hasURL ? websites[0].hasURL : null;

    // ensure website @type's are arrays
    if( newDoc["contactInfo"].hasURL ) {
      if( !Array.isArray(newDoc["contactInfo"].hasURL) ) {
        newDoc["contactInfo"].hasURL = [newDoc["contactInfo"].hasURL];
      }
      newDoc["contactInfo"].hasURL.forEach((url) => {
        let atType = Array.isArray(url['@type']) ? url['@type'] : [url['@type']];
        url["@type"] = atType;
      });
    }

    // keep only relations for this expert, and normalize favourite flag
    (newDoc['publications'] || []).forEach((node) => {
      node.relatedBy = (node.relatedBy || []).filter((rel) => {
        let relates = rel?.relates;
        if( !Array.isArray(relates) ) {
          relates = typeof relates === 'string' ? [relates] : [];
        }

        const isExpertRelationship = relates.includes(newDoc['@id']);
        if( !isExpertRelationship ) {
          return false;
        }

        if( typeof rel['ucdlib:favourite'] !== 'boolean' ) {
          rel['ucdlib:favourite'] = false;
        }

        return true;
      });
    });

    // preserve the modified-date
    newDoc["modified-date"] = doc["modified-date"];
    newArray.push(newDoc);
  }
  res.doc_array = newArray;
  next();
}


// function sitefarm_valid_path(options={}) {
//   const def = {
//     "description": "A JSON array of expert profiles including their publications",
//     "parameters": [
//       {
//         "in": "path",
//         "name": "ids",
//         "description": "A comma separated list of expert IDs. Ids are in the format of '{idType}:{Id}'. For example 'expertId:12345'",
//         "required": true,
//         "schema": {
//           "type": "string"
//         }
//       }
//     ],
//   };

//   (options.parameters || []).forEach((param) => {
//     def.parameters.push(openapi.parameters(param));
//   });

//   delete options.parameters;

//   return openapi.validPath({...def, ...options});
// }

// function sitefarm_valid_path_error(err, req, res, next) {
//   return res.status(err.status).json({
//     error: err.message,
//     validation: err.validationErrors,
//     schema: err.validationSchema
//   })
// }


// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
// router.use(openapi);

router.get('/openapi.json', (req, res) => {
  // Short-term patch: serve a static, stable OpenAPI document.
  res.type('application/json').json({
    openapi: '3.0.3',
    info: {
      title: 'Experts SiteFarm Integration API',
      version: '1.39.0-dev-36-gfbf935e-dirty',
      description: 'Allows for the retrieval of expert information to be displayed on the SiteFarm platform.',
      termsOfService: 'https://experts.ucdavis.edu/termsofuse',
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
        size: {
          in: 'query',
          name: 'size',
          description: 'The number of results to return per page, defaults to 25',
          required: false,
          schema: {
            type: 'integer'
          }
        }
      },
      schemas: {
        Expert: {
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
        }
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer'
        }
      },
      responses: {
        Expert: {
          description: 'The expert',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Expert'
              }
            }
          }
        },
        Expert_not_found: { description: 'Expert not found' },
        Expert_deleted: { description: 'Expert deleted' },
        No_content: { description: 'No Content' },
        Invalid_request: { description: 'Invalid request' },
        Successful_operation: { description: 'Successful operation' },
        Invalid_ID_supplied: { description: 'Invalid ID supplied' }
      },
      requestBodies: {
        Relationship_patch: {
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
        }
      }
    },
    servers: [{ url: 'http://experts.ucdavis.edu/api/sitefarm' }],
    tags: [{ name: 'expert', description: 'Expert Information' }],
    paths: {
      '/api/expert/{expertId}': {
        get: {
          description: 'Get an expert by id',
          parameters: [{ name: 'expertId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { $ref: '#/components/responses/Expert' },
            404: { $ref: '#/components/responses/Expert_not_found' }
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
      }
    }
  });
});

const path = require('path');

router.get('/', (req, res) => {
  // Short term: keep this route, but redirect to the OpenAPI JSON endpoint
  res.redirect('/api/sitefarm/openapi.json');
  // Previous behavior (kept here if needed later):
  // res.sendFile(path.join(__dirname, 'swagger.json'));
});

router.get(
  '/experts/:ids',
  // sitefarm_valid_path(
  //   {
  //     description: "Returns a JSON array of expert profiles",
  //     responses: {
  //       "200": openapi.response('Successful_operation'),
  //       "400": openapi.response('Invalid_ID_supplied'),
  //       "404": openapi.response('Expert_not_found')
  //     }
  //   }
  // ),
  // sitefarm_valid_path_error,
  has_access('sitefarm'),
  convertIds,
  async (req, res, next) => {
    const expert_model = await model.get_model('expert');
    res.doc_array = [];
    var doc;
    // validate the modified_since date
    if (req.query.modified_since) {
      const modifiedSinceDate = new Date(req.query.modified_since);
      const [year, month, day] = req.query.modified_since.split('-').map(Number);
      const isValidDate = modifiedSinceDate.getFullYear() === year &&
                          modifiedSinceDate.getMonth() + 1 === month &&
                          modifiedSinceDate.getDate() === day;
      if (isNaN(modifiedSinceDate.getTime()) || !isValidDate) {
        return res.status(400).json({ error: 'Invalid modified_since date format' });
      }
    }
    const gte_date = req.query.modified_since || '2021-01-01';
    const params={
      "gte_date": gte_date,
      "expert": []
    };

    if( Array.isArray(req.expertIds) && req.expertIds.length ) {
      params.expert = req.expertIds;
    }

    let opts = {
      "id": "modified-date",
      "params": params
    };
    await expert.verify_template(template);
    res.doc_array = [];
    var find = null
    try {
      find = await base.search(opts);
      res.doc_array = find.hits;
      res.doc_array = find.hits;
    } catch (error) {
      return res.status(500).json({ error: 'Error fetching expert data', details: error.message });
    }
    next();
  },
  siteFarmFormat,
  (req, res) => {
    res.status(200).json(res.doc_array);
  }
);

const model = new ExpertModel();
// module.exports = defaultEsApiGenerator(model, { router });

module.exports = router;
