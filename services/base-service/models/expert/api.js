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


function sanitize(req, res, next) {
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
    //    res.status(200).json(JSON.stringify(req));
    logger.info({function:"GET :expert/ark:/87287/d7mh2m/relationship/:id"},`req.path=${req.path}`);
    let id = decodeURIComponent(req.path).replace(/^\/[a-zA-Z0-9]+\//,'');
  logger.info({function:"GET :expert/ark:/87287/d7mh2m/relationship/:id"},`req.path=${req.path} id=${id}`);
    try {
      const authorship_model = await model.get_model('authorship');
      let opts = {
        admin : req.query.admin ? true : false,
      }
      res.thisDoc = await authorship_model.get(id, opts);
      logger.info({function:'get'},JSON.stringify(res.thisDoc));
      return next();
    } catch(e) {
     res.status(404).json(`${id} from ${req.path} HELP ${e.message}`);
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
    let expertId=req.params.expertId;
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
      let id = decodeURIComponent(req.path).replace(/^\/[a-zA-Z0-9]+\//,'');

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
    console.log(`expert ${req.params.expertId}`);
    let id = model.id+'/'+req.params.expertId;
     try {
      let opts = {
        admin: req.query.admin ? true : false,
      }
      res.thisDoc = await model.get(id, opts);
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
    let id = decodeURIComponent(req.path).replace(/^\//, '');
    let data = req.body;
    try {
      let resp;
      patched=await model.patch(data,id);
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
      let id = decodeURIComponent(req.path).replace(/^\//, '');
      await model.delete(id);
      res.status(204).json({status: "ok"});
    } catch(e) {
      next(e);
    }
  }
);

module.exports = router;
