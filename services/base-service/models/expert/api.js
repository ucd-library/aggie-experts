const path = require('path');
const express = require('express');
const router = require('express').Router();
const {dataModels, logger} = require('@ucd-lib/fin-service-utils');
const ExpertModel = require('./model.js');
const {defaultEsApiGenerator} = dataModels;
const md5 = require('md5');
// const { logger } = require('@ucd-lib/fin-service-utils');
const model= new ExpertModel();

const { openapi, schema_error, json_only, user_can_edit, is_user } = require('../middleware.js')

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

router.get('/', (req, res) => {
  res.redirect('/api/expert/openapi.json');
});

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
router.use(openapi);

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
).get(
  is_user,
  expert_valid_path(
    {
      description: "Get an expert relationship by id",
      responses: {
        "200": openapi.response('Relationship'),
        "404": openapi.response('Relationship_not_found')
      }
    }
  ),
  expert_valid_path_error,
  user_can_edit,
  async (req, res, next) => {
    let id = req.params.relationshipId;
    try {
      const authorship_model = await model.get_model('authorship');
      res.thisDoc = await authorship_model.get(id);
      logger.info({function:'get'},JSON.stringify(res.thisDoc));
      return next();
    } catch(e) {
     res.status(404).json(`${id} from ${req.path} - ${e.message}`);
    }
  },
  async (req, res, next) => {
   res.status(200).json(res.thisDoc);
  }
).patch(
  expert_valid_path(
    {
      description: "Update an expert relationship by id",
      // hack, in the validate.js makeValidator() func of the npm package,
      // it's looking for schema.requestBody.content to build from, and can't use the ref returned from openapi.requestBodies()
      requestBody: {
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
      },
      responses: {
        "204": openapi.response('No_content'),
        "404": openapi.response('Relationship_not_found')
      }
    }
  ),
  expert_valid_path_error,
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
        role_model = await model.get_model('authorship');
      }
      patched=await role_model.patch(data,expertId);
      res.status(204).json();
//      res.status(200).json({status: 'ok'});
    } catch(e) {
      next(e);
    }
  }
).delete(
  expert_valid_path(
    {
      description: "Update an expert relationship by id",
      responses: {
        "204": openapi.response('No_content'),
        "404": openapi.response('Relationship_not_found')
      }
    }
  ),
  expert_valid_path_error,
  user_can_edit,
  async (req, res, next) => {
    logger.info(`DELETE ${req.url}`);

    try {
      let expertId = `expert/${req.params.expertId}`;
      let id = req.params.relationshipId;

      const authorshipModel = await model.get_model('authorship');
      await authorshipModel.delete(id, expertId);
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

router.route(
  '/:expertId'
).get(
  is_user,
  expert_valid_path(
    {
      description: "Get an expert by id",
      responses: {
        "200": openapi.response('Expert'),
        "404": openapi.response('Expert_not_found')
      }
    }
  ),
  expert_valid_path_error,
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
).post(
  is_user,
  expert_valid_path(
    {
      description: "Get an expert by id",
      requestBody: {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "is-visible": {
                  "type": "boolean"
                },
                "expert": {
                  "type": "object",
                  "properties": {
                    "include": {
                      "type": "boolean"
                    }
                  }
                },
                "grants": {
                  "type": "object",
                  "properties": {
                    "include": {
                      "type": "boolean"
                    },
                    "page": {
                      "type": "integer"
                    },
                    "size": {
                      "type": "integer"
                    },
                    "exclude": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "includeMisformatted": {
                      "type": "boolean"
                    },
                    "sort": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "field": {
                            "type": "string"
                          },
                          "sort": {
                            "type": "string"
                          },
                          "type": {
                            "type": "string"
                          }
                        }
                      }
                    }
                  }
                },
                "works": {
                  "type": "object",
                  "properties": {
                    "include": {
                      "type": "boolean"
                    },
                    "page": {
                      "type": "integer"
                    },
                    "size": {
                      "type": "integer"
                    },
                    "exclude": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "includeMisformatted": {
                      "type": "boolean"
                    },
                    "sort": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "field": {
                            "type": "string"
                          },
                          "sort": {
                            "type": "string"
                          },
                          "type": {
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
        }
      },
      responses: {
        "200": openapi.response('Expert'),
        "404": openapi.response('Expert_not_found')
      }
    }
  ),
  expert_valid_path_error,
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
  expert_valid_path(
    {
      description: "Update an experts visibility by expert id",
      requestBody: {
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
      },
      responses: {
        "204": openapi.response('No_content')
      }
    }
  ),
  expert_valid_path_error,
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
  expert_valid_path(
    {
      description: "Delete an expert by id",
      responses: {
        "204": openapi.response('Expert_deleted')
      }
    }
  ),
  expert_valid_path_error,
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
