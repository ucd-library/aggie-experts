const express = require('express');
const router = require('express').Router();
const { config, keycloak, dataModels, logger } = require('@ucd-lib/fin-service-utils');
const ExpertModel = require('../expert/model.js');
const expert = new ExpertModel();
const { defaultEsApiGenerator } = dataModels;
// const {config, keycloak} = require('@ucd-lib/fin-service-utils');
const md5 = require('md5');

const { openapi, json_only, validate_admin_client, validate_miv_client, has_access, fetchExpertId, convertIds } = require('../middleware.js')


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
    "description": "A JSON array of expert profiles including their publications",
    "parameters": [
      {
        "in": "path",
        "name": "ids",
        "description": "A comma separated list of expert IDs. Ids are in the format of '{idType}:{Id}'. For example 'expertId:12345'",
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

const path = require('path');

router.get('/', (req, res) => {
  // Send the pre-made swagger.json file
  res.sendFile(path.join(__dirname, 'swagger.json'));
  // res.redirect('/api/sitefarm/openapi.json');
});

router.get(
  '/experts/:ids',
  sitefarm_valid_path(
    {
      description: "Returns a JSON array of expert profiles",
      responses: {
        "200": openapi.response('Successful_operation'),
        "400": openapi.response('Invalid_ID_supplied'),
        "404": openapi.response('Expert_not_found')
      }
    }
  ),
  sitefarm_valid_path_error,
  json_only,
  validate_admin_client,
  validate_miv_client,
  has_access('sitefarm'),
  convertIds, // convert submitted iamIds to expertIds
  async (req, res, next) => {
    const expert_model = await model.get_model('expert');
    res.doc_array = [];
    var doc;

    for (const id of req.query.expertIds) {
      const expertId = `${expert_model.id}/${id}`;
      try {
        let opts = {
          admin: req.query.admin ? true : false,
        }
        doc = await expert_model.get(expertId, opts);
        doc=expert_model.subselect(doc);
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

const model = new ExpertModel();
module.exports = defaultEsApiGenerator(model, { router });

module.exports = router;
