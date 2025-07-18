const path = require('path');
const express = require('express');
const router = require('express').Router();
const {dataModels, logger} = require('@ucd-lib/fin-service-utils');
const ExpertModel = require('./model.js');
const {defaultEsApiGenerator} = dataModels;
const md5 = require('md5');
// const { logger } = require('@ucd-lib/fin-service-utils');
const model= new ExpertModel();

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

router.get('/', (req, res) => {
  res.redirect('/api/expert/openapi.json');
});

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
router.use(openapi);

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
  expert_valid_path(
    {
      description: "Get all expert data by id",
      responses: {
        "200": openapi.response(model.name),
        "400": openapi.response('missing_id'),
        "403": openapi.response('forbidden'),
        "404": openapi.response('not_found')
      }
    //   parameters: {
    //     "id": {
    //       "name": "id",
    //       "in": "path",
    //       "description": "identifier",
    //       "required": true,
    //       "schema": { "type": "string" }
    //     }
    //   }
    }
    ),
  public_or_is_user,
  expert_valid_path_error,
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
