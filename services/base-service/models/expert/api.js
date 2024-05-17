const path = require('path');
const express = require('express');
const router = require('express').Router();
const {dataModels, logger} = require('@ucd-lib/fin-service-utils');
const ExpertModel = require('./model.js');
const {defaultEsApiGenerator} = dataModels;
const md5 = require('md5');
// const { logger } = require('@ucd-lib/fin-service-utils');
const model= new ExpertModel();

const { openapi, schema_error, json_only, user_can_edit } = require('../middleware.js')

// This is destined for middleware.js
function is_user(req,res,next) {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  return next();
}

function sanitize(req, res, next) {
//  logger.info({function:'sanitize'}, JSON.stringify(req.query));
  if ('no-sanitize' in req.query) {
      user_can_edit(req, res, next);
  } else {
    try {
      res.thisDoc = model.sanitize(res.thisDoc);
      next();
    } catch (e) {
      res.status(e.status || 500).json({error:e.message});
    }
  }
}

router.get('/', (req, res) => {
  res.redirect('/api/expert/openapi.json');
});

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
router.use(openapi);

router.route(
  '/:expertId/:relationshipId'
).get(
  is_user,
  openapi.validPath(
    {
      "description": "Get an expert relationship by id",
      "parameters": [
        // {
        //   "in": "path",
        //   "name": "expertId",
        //   "description": "The id of the expert to get",
        //   "required": true,
        //   "schema": {
        //     "type": "string"
        //   }
        // },
        {
          "in": "path",
          "name": "relationshipId",
          "description": "The id of the relationship to get",
          "required": true,
          "schema": {
            "type": "string"
          }
        },
        {
          "in": "query",
          "name": "fakeId",
          "description": "The id of something fake for testing validation",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "The relationship",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Expert"
              }
            }
          }
        },
        "404": {
          "description": "Relationship not found"
        }
      }
    }
  ),
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
  openapi.validPath(
    {
      "description": "Update an expert relationship by id",
      "parameters": [
        // "#components/parameters/expertId",
        "#components/parameters/relationshipId"
      ],
      "responses": {
        "204": {
          "description": "The update status",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Expert"
              }
            }
          }
        },
        "404": {
          "description": "Relationship not found"
        }
      }
    }
  ),
  user_can_edit,
  json_only,
  async (req, res, next) => {
    let expertId=`expert/${req.params.expertId}`
    let data = req.body;

    try {
      let resp;
      let role_model;
      if( data.grant ) {
        role_model = await model.get_model('grant_role');
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
  openapi.validPath(
    {
      "description": "Delete an expert relationship by id",
      "parameters": [
        // "#components/parameters/expertId",
        "#components/parameters/relationshipId"
      ],
      "responses": {
        "204": {
          "description": "The delete status",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Expert"
              }
            }
          }
        },
        "404": {
          "description": "Relationship not found"
        }
      }
    }
  ),
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
  // TODO for parameters, if we let them auto build (from express route params), then they work..
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
  sanitize, // Remove the graph nodes that are not visible
  (req, res) => {
    res.status(200).json(res.thisDoc);
  }
).patch(
  expert_valid_path(
    {
      "description": "Update an experts visibility by expert id",

      // TODO this doesn't really do anything, what syntax do we need?
      "content": {
        "application/json": {
          "schema": {
            // Valid schema
          }
        }
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
      "description": "Delete an expert by id",
      "responses": {
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
