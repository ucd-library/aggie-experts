const router = require('express').Router();
const {dataModels,logger} = require('@ucd-lib/fin-service-utils');
const ExpertModel = require('./model.js');
const {defaultEsApiGenerator} = dataModels;
const md5 = require('md5');
// const { logger } = require('@ucd-lib/fin-service-utils');

async function siteFarmFormat(req, res, next) {
  // Check if the request is for the site-farm format
  const acceptHeader = req.headers.accept;
  if (!(acceptHeader && acceptHeader.includes('site-farm'))) {
    next();
    return;
  }

  let doc = res.aeResponse;
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
  res.aeResponse = newDoc;
  next();
}

async function sanitize(req, res, next) {

  logger.info({function:'sanitize'}, JSON.stringify(req.query));
  let id = '/'+model.id+decodeURIComponent(req.path);
  if (('no-sanitize' in req.query) && req.user &&
      (id === '/expert/'+md5(req.user.preferred_username+"@ucdavis.edu") ||
       req.user?.roles?.includes('admin'))
     ) {
    next();
  } else {
    let doc = res.aeResponse;
    for(let i=0; i<doc["@graph"].length; i++) {
      logger.info({function:"sanitize"},`${doc["@graph"][i]["@id"]}`);
      if ((("is-visible" in doc["@graph"][i])
           && doc["@graph"][i]?.["is-visible"] !== true) ||
          (doc["@graph"][i].relatedBy && ("is-visible" in doc["@graph"][i].relatedBy)
           && doc["@graph"][i]?.relatedBy?.["is-visible"] !== true))
      { // remove this graph node
        if (doc["@graph"][i]?.["@type"] === "Expert") {
          res.status(404).json(`${req.path} resource not found`);
          // alternatively, we could return the parent resource
          //delete doc["@graph"];
          //break;
        } else {
          logger.info({function:"sanitize"},`_x_${doc["@graph"][i]["@id"]}`);
          doc["@graph"].splice(i, 1);
          i--;
        }
      } else { // sanitize this graph node
        logger.info({function:"sanitize"},`Deleting totalAwardAmount=${doc["@graph"][i]?.["totalAwardAmount"]}`);
        delete doc["@graph"][i]["totalAwardAmount"];
      }
    }
    res.aeResponse = doc;
    next()  // continue to the next middleware;
  }
}

// this path is used instead of the defined version in the defaultEsApiGenerator
router.get('/expert/*', async (req, res, next) => {
  // JM - this should be a global middleware if you want logging
  // logger.info(`GET ${req.url}`);

  let id = '/' + model.id + decodeURIComponent(req.path);
  try {
    let opts = {
      admin: req.query.admin ? true : false,
    }
    res.aeResponse = await model.get(id, opts);
    next();
  } catch (e) {
    return res.status(404).json(`${req.path} resource not found`);
  }
  // res.status(200).json(res.aeResponse);
},
  sanitize,
  siteFarmFormat, // JM - this could send the response as well
  (req, res) => {
    res.status(200).json(res.aeResponse);
  }
)

const model = new ExpertModel();
module.exports = defaultEsApiGenerator(model, {router});

module.exports = router;
