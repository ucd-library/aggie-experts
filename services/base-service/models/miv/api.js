// Routes for the MIV API
const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const md5 = require('md5');
const template = require('./template/miv_grants.json');
const expert = new ExpertModel();
const {config, keycloak} = require('@ucd-lib/fin-service-utils');
let AdminClient=null;

async function fetchExpertId (req, res, next) {
  if (req.query.email || req.query.ucdPersonUUID) {
    if (! AdminClient) {
      const { ExpertsKcAdminClient } = await import('@ucd-lib/experts-api');
      const oidcbaseURL = config.oidc.baseUrl;
      const match = oidcbaseURL.match(/^(https?:\/\/[^\/]+)\/realms\/([^\/]+)/);

      console.log(match[1], match[2]);
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
    const token = await keycloak.getServiceAccountToken();
    AdminClient.accessToken = token
  }
  let user;
  try {
    if (req.query.email) {
      const email = req.query.email;
      user = await AdminClient.findByEmail(email);
    } else if (req.query.ucdPersonUUID) {
      const ucdPersonUUID = req.query.ucdPersonUUID;
      console.log(`ucdPersonUUID:${ucdPersonUUID}`);
      user = await AdminClient.findByAttribute(`ucdPersonUUID:${ucdPersonUUID}`);
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send({error: 'Error finding expert'});
  }

  if (user && user?.attributes?.expertId) {
    const expertId = Array.isArray(user.attributes.expertId) ? user.attributes.expertId[0] : user.attributes.expertId;
    req.query.expertId = expertId;
    return next();
  } else {
    return res.status(404).send({error: `No expert found`});
  }
}

function is_miv(req, res, next) {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  if ( req.user?.roles?.includes('admin') || req.user?.roles?.includes('miv') ) {
    return next();
  }
  return res.status(403).send('Not Authorized');
}

router.get(
  '/user',
  is_miv,
  fetchExpertId,
  async (req, res) => {
    const expertId = req.query.expertId;
    try {
      res.send(expertId);
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
    }
  }
);

router.get(
  '/grants',
  is_miv,
  async (req, res) => {
    const params = {};

    if (req.query.userId) {
      params.expert = 'expert/'+md5(`${req.query.userId}@ucdavis.edu`);
    }
    for (const key in template.script.params) {
      if (req.query[key]) {
        params[key] = req.query[key];
      } else {
        params[key] = template.script.params[key];
      }
    }

    opts = {
      id: template.id,
      params
    };
    try {
      await expert.verify_template(template);
      const find = await expert.search(opts);
      // Modify for MIV format (old version)
      //jq '.hits[0]["_inner_hits"][0]| {"@id","title":.name,"end_date":.dateTimeInterval.end.dateTime,"start_date":.dateTimeInterval.start.dateTime,"grant_amount":.totalAwardAmount,"sponsor_id":.sponsorAwardId,"sponsor_name":.assignedBy.name,"type":.["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"].name,"role_label":(.relatedBy[] | select(.inheres_in) | .["@type"])}' new.json
      let grants = [];
      for (const hit of find.hits[0]._inner_hits) {
        grants.push({
          '@id': hit['@id'],
          title: hit.name,
          end_date: hit.dateTimeInterval.end.dateTime,
          start_date: hit.dateTimeInterval.start.dateTime,
          grant_amount: hit.totalAwardAmount,
          sponsor_id: hit.sponsorAwardId,
          sponsor_name: hit.assignedBy.name,
          type: hit['@type'],
          role_label: hit.relatedBy.find(x => x.inheres_in)['@type']
        });
        hit.relatedBy.forEach((x) => {
          if (! x.inheres_in) {
            grants.push({
              '@id': x['@id'],
              name: x.relates[0].name,
              role: x['@type']
            });
          }
        });
      }
      res.send({"@graph": grants});
    } catch (err) {
      // Write the error message to the console
      console.error(err);
      res.status(400).send(err);
      // res.status(400).send('Invalid request - no likey');
    }
  }
);

router.get(
  '/raw_grants',
  is_miv,
  async (req, res) => {
    const params = {};

    if (req.query.userId) {
      params.expert = 'expert/'+md5(`${req.query.userId}@ucdavis.edu`);
    }
    for (const key in template.script.params) {
      if (req.query[key]) {
        params[key] = req.query[key];
      } else {
        params[key] = template.script.params[key];
      }
    }

    opts = {
      id: template.id,
      params
    };
    try {
      await expert.verify_template(template);
      const find = await expert.search(opts);
      let grants = [];
      for (const hit of find.hits[0]._inner_hits) {
        grants.push(hit);
      }
      res.send(grants);
    } catch (err) {
      // Write the error message to the console
      console.error(err);
      res.status(400).send(err);
      // res.status(400).send('Invalid request - no likey');
    }
  }
);

module.exports = router;
