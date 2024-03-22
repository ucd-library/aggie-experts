const express = require('express');
const router = require('express').Router();
const { dataModels, logger } = require('@ucd-lib/fin-service-utils');
const SiteFarmModel = require('./model.js');
const { defaultEsApiGenerator } = dataModels;
const md5 = require('md5');
const path = require('path');


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

async function sanitize(req, res, next) {
  logger.info({ function: 'sanitize' }, JSON.stringify(req.query));
  let id = '/' + model.id + decodeURIComponent(req.path);
  if (('no-sanitize' in req.query) && req.user &&
    (id === '/expert/' + md5(req.user.preferred_username + "@ucdavis.edu") ||
      req.user?.roles?.includes('admin'))
  ) {
    return next();
  } else {
    var newArray = [];
    // loop through the documents and sanitize them
    for (let i in res.doc_array) {
      let doc = res.doc_array[i];
      newArray.push(model.apiUtils.sanitize(doc));
    }
    res.doc_array = newArray;
    return next();
  }
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

router.get('/experts/:ids', json_only, async (req, res, next) => {
  const id_array = req.params.ids.replace('ids=', '').split(',');
  const expert_model = await model.get_model('expert');
  res.doc_array = [];
  var doc;
  for (const id of id_array) {
    const full = 'expert/' + expert_model.id + '/' + id;
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


router.get('/experts/:ids', json_only, async (req, res, next) => {
  const id_array = req.params.ids.replace('ids=', '').split(',');
  const expert_model = await model.get_model('expert');
  res.doc_array = [];
  var doc;

  for (const id of id_array) {
    const full = 'expert/' + expert_model.id + '/' + id;
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

router.use('/api-docs', express.static(path.join(__dirname, './sitefarm.yaml')));

const model = new SiteFarmModel();
module.exports = defaultEsApiGenerator(model, { router });

module.exports = router;
