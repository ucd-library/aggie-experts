const router = require('express').Router();
const {dataModels,logger} = require('@ucd-lib/fin-service-utils');
const ExpertModel = require('./model.js');
const {defaultEsApiGenerator} = dataModels;
const md5 = require('md5');

async function sanitize(req, res) {
  logger.info({function:'sanitize'}, JSON.stringify(req.query));
  let id = '/'+model.id+decodeURIComponent(req.path);
  if (('no-sanitize' in req.query) && req.user &&
      (id === '/expert/'+md5(req.user.preferred_username+"@ucdavis.edu") ||
       req.user?.roles?.includes('admin'))
     ) {
    res.status(200).json(res.thisDoc);
  } else {
    let doc = res.thisDoc;
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
    res.status(200).json(doc);
  }
}

// this path is used instead of the defined version in the defaultEsApiGenerator
router.get(
  '/*',
  async (req, res, next) => {
    logger.info(`GET ${req.url}`);
    let id = '/'+model.id+decodeURIComponent(req.path);
    try {
      let opts = {
        admin : req.query.admin ? true : false,
      }
      res.thisDoc = await model.get(id, opts);
      next();
    } catch(e) {
      res.status(404).json(`${req.path} resource not found`);
    }
  },
  sanitize
);

const model = new ExpertModel();
module.exports = defaultEsApiGenerator(model, {router});

module.exports = router;
