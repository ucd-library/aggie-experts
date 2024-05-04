const express = require('express');
const router = require('express').Router();
const { config, dataModels, logger } = require('@ucd-lib/fin-service-utils');
const SiteFarmModel = require('./model.js');
const { defaultEsApiGenerator } = dataModels;
const md5 = require('md5');
const path = require('path');

const openapi = require('@wesleytodd/openapi')
const { json_only } = require('../middleware.js')

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

const oapi = openapi({
  openapi: '3.0.3',
  info: {
    title: 'Express',
    description: 'The SiteFarm API returns an array of expert profiles matching a provided list of IDs. This allows external systems including UCD SiteFarm to integrate Aggie Experts data into their sites. Publically available API endpoints can be used for access to experts data.',
    version: '1.0.0',
    termsOfService: 'http://swagger.io/terms/',
    contact: {
      email: 'aggie-experts@ucdavis.edu'
    },
    license: {
      name: 'Apache 2.0',
      url: 'http://www.apache.org/licenses/LICENSE-2.0.html'
    },
    version: config.experts.version,
  },
  servers: [
    {
      url: `${config.server.url}/api/sitefarm`
    }
  ],
  tags: [
    {
      name: 'sitefarm',
      description: 'SiteFarm Information'
    }
  ]
})

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
router.use(oapi);

router.get(
  '/experts/:ids',
  oapi.validPath(
    {
      "description": "Returns an array of expert profiles",
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
      "responses": {
        "200": {
          "description": "Successful operation",
          "content": {
            "application/json": {
              "schema": {
                "type": "string"
              }
            }
          }
        },
        "400": {
          "description": "Invalid ID supplied"
        },
        "404": {
          "description": "Expert not found"
        }
      }
    }
  ),
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
