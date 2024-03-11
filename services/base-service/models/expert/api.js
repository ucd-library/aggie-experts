const router = require('express').Router();
const {dataModels, logger} = require('@ucd-lib/fin-service-utils');
const ExpertModel = require('./model.js');
const {defaultEsApiGenerator} = dataModels;
const md5 = require('md5');
// const { logger } = require('@ucd-lib/fin-service-utils');


function user_can_edit(req, res, next) {
  let id = '/'+model.id+decodeURIComponent(req.path);
  // logger.info('Checking if user can edit', id, req.user);
  if (req.user &&
      (id === '/expert/'+md5(req.user.preferred_username+"@ucdavis.edu") ||
       req.user?.roles?.includes('admin'))
     ) {
    return next();
  }
  res.status(403).send('Forbidden');
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

async function sanitize(req, res, next) {
  logger.info({function:'sanitize'}, JSON.stringify(req.query));
  let id = '/'+model.id+decodeURIComponent(req.path);
  if ('no-sanitize' in req.query) {
    if (req.user &&
        (id === '/expert/'+md5(req.user.preferred_username+"@ucdavis.edu") ||
         req.user?.roles?.includes('admin'))
       ) {
      return next();
    } else {
      res.status(403).send('Forbidden');
    }
  } else {
    let doc = res.thisDoc;
    if (doc["is-visible"] === false) {
      res.status(404).send('Not Found');
    }
    // logger.info('Sanitizing', doc);
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
    res.thisDoc = doc;
    return next();
  }
}

router.route(
  /expert\/[a-zA-Z0-9]+\/ark\:\/87287\/d7mh2m\/relationship\/[0-9]+/
).get(
  user_can_edit,
  async (req, res, next) => {
    //    res.status(200).json(JSON.stringify(req));
    logger.info({function:"GET /expert/:id/ark:/87287/d7mh2m/relationship/:id"},`req.path=${req.path}`);
    let pathParts = decodeURIComponent(req.path).split('/');
    let id = '/' + model.id + '/' + pathParts.splice(3).join('/');

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
  user_can_edit,
  json_only,
  async (req, res, next) => {
    let pathParts = decodeURIComponent(req.path).split('/');
    let expertId = model.id + '/' + (pathParts[2] || '');
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
  user_can_edit,
  async (req, res, next) => {
    logger.info(`DELETE ${req.url}`);

    try {
      let pathParts = decodeURIComponent(req.path).split('/');
      let expertId = model.id + '/' + (pathParts[2] || '');
      let id = pathParts.slice(3).join('/');

      const authorshipModel = await model.get_model('authorship');
      await authorshipModel.delete(id, expertId);
      res.status(200).json({status: "ok"});
    } catch(e) {
      next(e);
    }
  }
);


// this path is used instead of the defined version in the defaultEsApiGenerator
router.route(
  /expert\/[a-zA-Z0-9]+$/
).get(
  async (req, res, next) => {
    let id = '/'+ model.id + decodeURIComponent(req.path);
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

const model = new ExpertModel();
module.exports = defaultEsApiGenerator(model, {router});

module.exports = router;
