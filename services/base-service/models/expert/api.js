const router = require('express').Router();
const {dataModels,logger} = require('@ucd-lib/fin-service-utils');
const ExpertModel = require('./model.js');
const utils = require('../utils.js')
const {defaultEsApiGenerator} = dataModels;
const md5 = require('md5');

async function remove_not_visible(req, res) {
  let id = '/'+model.id+decodeURIComponent(req.path);
  if (req.query.complete && req.user &&
      (id === '/expert/'+md5(req.user.preferred_username+"@ucdavis.edu") ||
       req.user?.roles?.includes('admin'))
     ) {
    res.status(200).json(res.thisDoc);
  } else {
    for(let i=0; i<doc["@graph"].length; i++) {
      if (doc["@graph"][i]?.["is-visible"] !== true) {
        if (doc["@graph"][i]?.["@type"] === "Expert") {
          res.status(404).json(errorResponse(model.id+' resource not found'));
          // alternatively, we could return the parent resource
          //delete doc["@graph"];
          //break;
        } else {
          doc["@graph"].splice(i, 1);
          i--;
        }
      }
    }
    res.status(200).json(res.thisDoc);
  }
}

// this path is used instead of the defined version in the defaultEsApiGenerator
router.get(
  '/*',
  async (req, res, next) => {
    try {
      let opts = {
        admin : req.query.admin ? true : false,
      }
      res.thisDoc = await model.get(id, opts);
      next();
    } catch(e) {
      res.status(404).json(errorResponse(model.id+' resource not found'));
    }
  },
  remove_not_visible
);

const model = new ExpertModel();
module.exports = defaultEsApiGenerator(model, {router});

module.exports = router;
