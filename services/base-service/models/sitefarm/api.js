const express = require('express');
const router = require('express').Router();
const { config, keycloak, dataModels, logger } = require('@ucd-lib/fin-service-utils');
const SiteFarmModel = require('./model.js');
const { defaultEsApiGenerator } = dataModels;
// const {config, keycloak} = require('@ucd-lib/fin-service-utils');
const md5 = require('md5');
const path = require('path');

const openapi = require('@wesleytodd/openapi')
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


// Custom middleware to check Content-Type
function json_only(req, res, next) {
  const contentType = req.get('Accept');
  if (contentType.startsWith('application/json') || contentType.startsWith('application/ld+json')) {
    // Content-Type is acceptable
    return next();
  } else {
    // Content-Type is not acceptable
    res.status(400).json({ error: 'Invalid Content-Type. Only application/json or application/ld+json is allowed.' });
  }
}

async function sanitize(req, res, next) {
  logger.info({ function: 'sanitize' }, JSON.stringify(req.query));
  let id = '/' + model.id + decodeURIComponent(req.path);

  if (('no-sanitize' in req.query) && req.user &&
    (id === req.user.expertId || req.user?.roles?.includes('admin'))
  ) {
    return next();
  } else {
    var newArray = [];
    for (let i in res.doc_array) {

      let doc = res.doc_array[i];
      let newDoc = {};

      for (let i = 0; i < doc["@graph"].length; i++) {
        logger.info({ function: "sanitize" }, `${doc["@graph"][i]["@id"]}`);
        if ((("is-visible" in doc["@graph"][i])
          && doc["@graph"][i]?.["is-visible"] !== true) ||
          (doc["@graph"][i].relatedBy && ("is-visible" in doc["@graph"][i].relatedBy)
            && doc["@graph"][i]?.relatedBy?.["is-visible"] !== true)) { // remove this graph node
          if (doc["@graph"][i]?.["@type"] === "Expert") {
            res.status(404).json(`${req.path} resource not found`);
            // alternatively, we could return the parent resource
            //delete doc["@graph"];
            //break;
          } else {
            logger.info({ function: "sanitize" }, `_x_${doc["@graph"][i]["@id"]}`);
            doc["@graph"].splice(i, 1);
            i--;
          }
        } else { // sanitize this graph node
          logger.info({ function: "sanitize" }, `Deleting totalAwardAmount=${doc["@graph"][i]?.["totalAwardAmount"]}`);
          delete doc["@graph"][i]["totalAwardAmount"];
        }
      }
      newArray.push(doc);
    }
    res.doc_array = newArray;
    return next();
  }
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

router.get('/experts/:ids',
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
  validate_admin_client,
  convertIds,
  async (req, res, next) => {
    const id_array = req.params.ids.replace('ids=', '').split(',');
    const expert_model = await model.get_model('expert');
    res.doc_array = [];
    var doc;

    for (const id of id_array) {
      const full = expert_model.id + '/' + id;
      try {
        let opts = {
          admin: req.query.admin ? true : false,
        }
        doc = await expert_model.get(full, opts);
        res.doc_array.push(doc);
      } catch (e) {
        // log the error - couldn't find the resource. But continue to the next one
        logger.error(`Could not get ${full}`);
      }
    }
    next();
  },
  sanitize,
  siteFarmFormat,
  (req, res) => {
    res.status(200).json(res.doc_array);
  }
);

// router.use('/api-docs', express.static(path.join(__dirname, './sitefarm.yaml')));

const model = new SiteFarmModel();
module.exports = defaultEsApiGenerator(model, { router });

module.exports = router;
