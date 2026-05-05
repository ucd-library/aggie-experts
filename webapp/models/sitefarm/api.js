const express = require('express');
const router = require('express').Router();
const BaseModel = require('../base/model.js');
const ExpertModel = require('../expert/model.js');
const template = require('./template/modified-date.js');
const expert = new ExpertModel();
const base = new BaseModel();

const md5 = require('md5');

const { json_only, has_access, fetchExpertId, convertIds } = require('../middleware/index.js')

function siteFarmFormat(req, res, next) {
  // This function will take the query return of expert data and format it for sitefarm

  var newArray = [];
  for (let i in res.doc_array) {
    // Expecting a single expert document
    let doc = res.doc_array[i];

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
          includeMisformattedd: false,
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
      } );

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
        let work = doc["@graph"][j];
        // Normalize author to always be an array
        if (work.author !== undefined && !Array.isArray(work.author)) {
          work.author = [work.author];
        }
        newDoc["publications"].push(work);
      }
    }

    // Copy other Expert properties to the new document
    newDoc["orcidId"] = doc["@graph"][i].orcidId;
    newDoc["overview"] = doc["@graph"][i].overview;
    newDoc["researcherId"] = doc["@graph"][i].researcherId;
    newDoc["scopusId"] = doc["@graph"][i].scopusId;

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

    // keep only relations for this expert, and normalize favourite flag
    (newDoc['publications'] || []).forEach((node) => {
      node.relatedBy = (node.relatedBy || []).filter((rel) => {
        let relates = rel?.relates;
        if( !Array.isArray(relates) ) {
          relates = typeof relates === 'string' ? [relates] : [];
        }

        const isExpertRelationship = relates.includes(newDoc['@id']);
        if( !isExpertRelationship ) {
          return false;
        }

        if( typeof rel['ucdlib:favourite'] !== 'boolean' ) {
          rel['ucdlib:favourite'] = false;
        }

        return true;
      });
    });

    // preserve the modified-date
    newDoc["modified-date"] = doc["modified-date"];
    newArray.push(newDoc);
  }
  res.doc_array = newArray;
  next();
}

router.get(
  '/experts/:ids',
  has_access('sitefarm'),
  convertIds,
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

    if( Array.isArray(req.expertIds) && req.expertIds.length ) {
      params.expert = req.expertIds;
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

module.exports = router;
