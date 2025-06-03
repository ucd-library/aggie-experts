const express = require('express');
const router = require('express').Router();
const { config, keycloak, dataModels, logger } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');
const ExpertModel = require('../expert/model.js');
const template = require('./template/modified-date.js');
const expert = new ExpertModel();
const base = new BaseModel();
// const experts = new ExpertModel();

const { defaultEsApiGenerator } = dataModels;
// const {config, keycloak} = require('@ucd-lib/fin-service-utils');
const md5 = require('md5');

const { openapi, json_only, validate_admin_client, validate_miv_client, has_access, fetchExpertId, convertIds } = require('../middleware/index.js')


function siteFarmFormat(req, res, next) {

  var newArray = [];
  for (let i in res.doc_array) {

    let doc = res.doc_array[i];
    doc = expert.subselect(
      doc,
      {
        'is-visible' : true,
        expert : { include : true },
        grants : {
          include : false
        },
        works : {
          include :true,
          page : 1,
          size : 5
        }
      } );

    let newDoc = {};

    newDoc["@id"] = doc["@id"];
    newDoc["publications"] = [];
    newDoc["contactInfo"] = doc.contactInfo || {};
    newDoc["contactInfo"].hasURL = []; // initialize to empty array
    let websites = doc["@graph"][i].contactInfo?.filter(c => (!c['isPreferred'] || c['isPreferred'] === false) && c['rank'] === 20 && c.hasURL);

    if (doc["@graph"][i]["@type"].includes("Expert")) {
      for (let j = 0; j < doc["@graph"][i]["contactInfo"].length; j++) {
        if (doc["@graph"][i]["contactInfo"][j].isPreferred === true) {
          newDoc["contactInfo"] = doc["@graph"][i].contactInfo[j];
        }
      }
    }
    newDoc["orcidId"] = doc["@graph"][i].orcidId;
    newDoc["overview"] = doc["@graph"][i].overview;
    newDoc["researcherId"] = doc["@graph"][i].researcherId;
    newDoc["scopusId"] = doc["@graph"][i].scopusId;
    //   }
    if (doc["@graph"][i]["@type"] && doc["@graph"][i]["@type"].includes("Work")) {
      newDoc["publications"].push(doc["@graph"][i]);
    }

    newDoc["contactInfo"].hasURL = websites[0].hasURL && websites.length > 0 ? websites[0].hasURL : null;
    // preserve the modified-date
    newDoc["modified-date"] = doc["modified-date"];
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
  validate_admin_client,
  validate_miv_client,
  has_access('sitefarm'),
  convertIds, // convert submitted iamIds to expertIds
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

    if (req?.query.expert) {
      params.expert = req.query.expert.split(',');
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
module.exports = defaultEsApiGenerator(model, { router });

module.exports = router;
