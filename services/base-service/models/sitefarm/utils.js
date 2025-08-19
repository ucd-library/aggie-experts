// const router = require('express').Router();
// const path = require('path');

const { dataModels } = require('@ucd-lib/fin-service-utils');
const BaseModel = require('../base/model.js');
const ExpertModel = require('../expert/model.js');
const template = require('./template/modified-date.js');

const expert = new ExpertModel();
const base = new BaseModel();
// const { defaultEsApiGenerator } = dataModels;

const {
  openapi,
  // validate_admin_client,
  // validate_miv_client,
  // has_access,
  // convertIds
} = require('../middleware/index.js')

async function siteFarmDefaultSearch(req, res, next) {
  // const expert_model = await model.get_model('expert');
    res.doc_array = [];
    // var doc;
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
    let find = null;
    try {
      find = await base.search(opts);
      res.doc_array = find.hits;
      // res.doc_array = find.hits;
    } catch (error) {
      return res.status(500).json({ error: 'Error fetching expert data', details: error.message });
    }
    next();
}

function formatBaseDocArray(doc_array=[]) {
  // This function will take the query return of expert data and format it for sitefarm
  let newArray = [];
  let esDocs = [];
  for (let i in doc_array) {
    // Expecting a single expert document
    let doc = doc_array[i];

    // Subselect to experts and their works - max return 5 works
    doc = expert.subselect(
      doc,
      {
        'is-visible' : true,
        expert : { include : true },
        grants : {
          include : false,
          exclude: [
            "totalAwardAmount"
          ],
          includeMisformatted: false,
          sort: [
            {
              "field": "dateTimeInterval.end.dateTime",
              "sort": "desc",
              "type": "date"
            },
            {
              "field": "name",
              "sort": "asc",
              "type": "string"
            }
          ]
        },
        works : {
          include :true,
          page : 1,
          size : 5,
          includeMisformatted : false,
          sort : [
            {
              "field": "issued",
              "sort": "desc",
              "type": "year"
            },
            {
              "field": "title",
              "sort": "asc",
              "type": "string"
            } ]
        }
    });
    esDocs.push(doc);

    let newDoc = {};

    newDoc["@id"] = doc["@id"];
    newDoc["publications"] = [];
    newDoc["contactInfo"] = doc.contactInfo || {};
    newDoc["contactInfo"].hasURL = []; // initialize to empty array
    // We need to dig down for the preferred contactInfo website list
    // We will grab the first website that is not preferred and has a rank of 20 indicating it is a website list
    let websites = doc["@graph"][0].contactInfo?.filter(c => (!c['isPreferred'] || c['isPreferred'] === false) && c['rank'] === 20 && c.hasURL);

    // ... but also grab all preferred contactInfo details
    for (let j = 0; j < doc["@graph"].length; j++) {
      if (doc["@graph"][j]["@type"].includes("Expert")) {
        if (doc["@graph"][j]["contactInfo"].isPreferred === true) {
          newDoc["contactInfo"] = doc["@graph"][j].contactInfo;
        }
      }
      // If the node is a Work, copy it to the publications array
      else if (doc["@graph"][j]["@type"].includes("Work")) {
        newDoc["publications"].push(doc["@graph"][j]);
      }
    }

    // Copy other Expert properties to the new document
    newDoc["orcidId"] = doc["@graph"][0].orcidId;
    newDoc["overview"] = doc["@graph"][0].overview;
    newDoc["researcherId"] = doc["@graph"][0].researcherId;
    newDoc["scopusId"] = doc["@graph"][0].scopusId;

    // Include the website list we filtered for above
    newDoc["contactInfo"].hasURL = websites.length > 0 && websites[0].hasURL ? websites[0].hasURL : null;

    // ensure website @type's are arrays
    if( newDoc["contactInfo"].hasURL ) {
      if( !Array.isArray(newDoc["contactInfo"].hasURL) ) {
        newDoc["contactInfo"].hasURL = [newDoc["contactInfo"].hasURL];
      }
      newDoc["contactInfo"].hasURL.forEach((url) => {
        let atType = Array.isArray(url['@type']) ? url['@type'] : [url['@type']];
        url["@type"] = atType;
      });
    }

    // preserve the modified-date
    newDoc["modified-date"] = doc["modified-date"];
    newArray.push(newDoc);
  }

  return { newArray, esDocs };
}

function siteFarmFormat(req, res, next) {
  const {
    newArray
  } = formatBaseDocArray(res.doc_array || []);
  res.doc_array = newArray;
  next();
}

/**
 * @method siteFarmPreviewFormat
 * @description additional processing for preview format (?preview in url).
 * logic will be moved to siteFarmFormat once tested by the SF team, so with/without
 * preview param will return same data, to allow staggered releases between AE/SF
 * without the complexity of url versioning and maintaining/deprecating multiple apis
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @param {Function} next - next middleware function
 */
function siteFarmPreviewFormat(req, res, next) {
   const {
    newArray,
    esDocs
  } = formatBaseDocArray(res.doc_array || []);

  // support multiple email addresses (issue #1000)
  newArray.forEach((doc) => {
    let matchedGraph = (esDocs || []).find((esDoc) => esDoc['@id'] === doc['@id']);
    if( !matchedGraph || !matchedGraph['@graph'] ) return;

    matchedGraph = matchedGraph['@graph'][0];
    if( matchedGraph ) {
      let emails = matchedGraph.contactInfo?.filter(c => c['isPreferred'] === true).map(c => c?.hasEmail); // emails are from roles, different than website rank
      if( emails ) {
        doc['contactInfo'].hasEmail = emails;
      }
    }
  });

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

module.exports = {
  siteFarmDefaultSearch,
  siteFarmFormat,
  siteFarmPreviewFormat,
  sitefarm_valid_path,
  sitefarm_valid_path_error
};
