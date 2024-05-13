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

function user_can_edit(req, res, next) {
  let id= req.params.expertId;
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  if ( req.user?.roles?.includes('admin')) {
    return next();
  }
  if( id === req.user?.attributes?.expertId ) {
    return next();
  }

  return res.status(403).send('Not Authorized');
}


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
  openapi.validPath(
    {
      "description": "Get an expert relationship by id",
      "parameters": [
        "#components/parameters/expertId",
        "#components/parameters/relationshipId"
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
        "#components/parameters/expertId",
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
        "#components/parameters/expertId",
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

function expert_valid_path(options) {
  const def = {
    "description": "Get an expert by id",
    "parameters": [
      "#components/parameters/expertId"
    ],
    "responses": {
      "Expert": "#/components/responses/Expert",
      "$ref": "#/components/responses/404_Expert_not_found"
    }
  };
  const this_path=openapi.validPath({...def, ...options})
  return this_path;
//  return (req, res,next) => {
//    this_path(req,res,()=>{schema_error(req, res, next)})
//  };
}

router.route(
  '/:expertId'
).get(
  expert_valid_path({description: "Get an expert by id"}),
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
    {"description": "Update an experts visibility by expert id",
     "content": {
       "application/json": {
         "schema": {
           // Valid schema
         }
       }
     }
    }),
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
  expert_valid_path({"description": "Delete an expert by id"}),
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
