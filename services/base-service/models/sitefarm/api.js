const express = require('express');
const router = require('express').Router();
const { config, keycloak, dataModels, logger } = require('@ucd-lib/fin-service-utils');
const SiteFarmModel = require('./model.js');
const { defaultEsApiGenerator } = dataModels;
// const {config, keycloak} = require('@ucd-lib/fin-service-utils');
const md5 = require('md5');
const path = require('path');

const { openapi, json_only } = require('../middleware.js')
let AdminClient=null;

async function validate_admin_client(req, res, next) {
  if (! AdminClient) {
    const { ExpertsKcAdminClient } = await import('@ucd-lib/experts-api');
    const oidcbaseURL = config.oidc.baseUrl;
    const match = oidcbaseURL.match(/^(https?:\/\/[^\/]+)\/realms\/([^\/]+)/);

    if (match) {
      AdminClient = new ExpertsKcAdminClient(
        {
          baseUrl: match[1],
          realmName: match[2]
        }
      );
    } else {
      throw new Error(`Invalid oidc.baseURL ${oidcbaseURL}`);
    }
  }
  next();
}

async function convertIds(req, res, next) {
  const id_array = req.params.ids.replace('ids=', '').split(',');

  let user;
  // for each id, get the expertId
  for (const ucdPersonUUID of id_array) {
    try {
           console.log('ucdPersonUUID', ucdPersonUUID);
      user = await AdminClient.findOneByAttribute(`ucdPersonUUID:${ucdPersonUUID}`);
    }
    catch (err) {
      console.error(err);
    }

    if (user && user?.attributes?.expertId) {
      const expertId = Array.isArray(user.attributes.expertId) ? user.attributes.expertId[0] : user.attributes.expertId;
      req.query.expertId = expertId;
    }
  }
  return next();
}

function siteFarmFormat(req, res, next) {

  var newArray = [];
  for (let i in res.doc_array) {

    let doc = res.doc_array[i];
    let newDoc = {};
    logger.info({ function: 'siteFarmFormat' });

    newDoc["@id"] = doc["@id"];
    newDoc["publications"] = [];

    for (let i = 0; i < doc["@graph"].length; i++) {
      if (doc["@graph"][i]["@type"].includes("Expert")) {
        for (let j = 0; j < doc["@graph"][i]["contactInfo"].length; j++) {
          if (doc["@graph"][i]["contactInfo"][j].isPreferred === true) {
            newDoc["contactInfo"] = doc["@graph"][i].contactInfo[j];
          }
        }
        newDoc["orcidId"] = doc["@graph"][i].orcidId;
        newDoc["overview"] = doc["@graph"][i].overview;
        newDoc["researcherId"] = doc["@graph"][i].researcherId;
        newDoc["scopusId"] = doc["@graph"][i].scopusId;
      }
      if (doc["@graph"][i]["@type"].includes("Work")) {
        newDoc["publications"].push(doc["@graph"][i]);
      }
    }
    newArray.push(newDoc);
  }
  res.doc_array = newArray;
  next();
}

function sitefarm_valid_path(options={}) {
  const def = {
    "description": "List of expert profiles",
    "parameters": [
      {
        "in": "path",
        "name": "ids",
        "description": "A comma separated list of expert IDs",
        "required": true,
        "schema": {
          "type": "string"
        }
      }
    ],
  };

  (options.parameters || []).forEach((param) => {
    def.parameters.push(openapi.parameters(param));
  });

  delete options.parameters;

  return openapi.validPath({...def, ...options});
}

function sitefarm_valid_path_error(err, req, res, next) {
  return res.status(err.status).json({
    error: err.message,
    validation: err.validationErrors,
    schema: err.validationSchema
  })
}

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
router.use(openapi);

router.get(
  '/experts/:ids',
  sitefarm_valid_path(
    {
      description: "Returns a list of expert profiles",
      responses: {
        "200": openapi.response('Successful_operation'),
        "400": openapi.response('Invalid_ID_supplied'),
        "404": openapi.response('Expert_not_found')
      }
    }
  ),
  sitefarm_valid_path_error,
  json_only,
  async (req, res, next) => {
    const id_array = req.params.ids.replace('ids=', '').split(',');
    const expert_model = await model.get_model('expert');
    res.doc_array = [];
    var doc;

    for (const id of id_array) {
      const expertId = `${expert_model.id}/${id}`;
      try {
        let opts = {
          admin: req.query.admin ? true : false,
        }
        doc = await expert_model.get(expertId, opts);
        doc=expert_model.sanitize(doc);
        res.doc_array.push(doc);
      } catch (e) {
        // log the error - couldn't find the resource. But continue to the next one
        logger.error(`Could not get ${expertId}`, e);
      }
    }
    next();
  },
  siteFarmFormat,
  (req, res) => {
    res.status(200).json(res.doc_array);
  }
);

// router.use('/api-docs', express.static(path.join(__dirname, './sitefarm.yaml')));

const model = new SiteFarmModel();
module.exports = defaultEsApiGenerator(model, { router });

module.exports = router;
