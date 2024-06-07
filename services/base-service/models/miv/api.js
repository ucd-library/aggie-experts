// Routes for the MIV API
const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/miv_grants.json');
const expert = new ExpertModel();
const {config, keycloak} = require('@ucd-lib/fin-service-utils');
let AdminClient=null;

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

let MIVJWKSClient=null;

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

async function validate_miv_client(req, res, next) {
  if (! MIVJWKSClient) {
    const { ExpertsKcAdminClient } = await import('@ucd-lib/experts-api');
    const oidcbaseURL = config.oidc.baseUrl;
    const match = oidcbaseURL.match(/^(https?:\/\/[^\/]+)\/realms\/([^\/]+)/);

    if (match) {
      MIVJWKSClient = await jwksClient({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${match[1]}/realms/aggie-experts-miv/protocol/openid-connect/certs`
      });
    } else {
      throw new Error(`Invalid oidc.baseURL ${oidcbaseURL}`);
    }
  }
  next();
}

// function is_miv(req, res, next) {
//   if (!req.user) {
//     // Try MIV Service Account
//     return is_miv_service_account(req, res, next);
//   }
//   if ( req.user?.roles?.includes('admin') || req.user?.roles?.includes('miv') ) {
//     return next();
//   }
//   return res.status(403).send('Not Authorized');
// }

// Middleware to validate client credential token
async function is_miv_service_account(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token not provided' });
  }

  try {
    // Get the public key from the JWKS endpoint
    const key = await MIVJWKSClient.getSigningKey(jwt.decode(token, { complete: true }).header.kid);
    // Verify the token's signature using the public key
    const verifiedToken = jwt.verify(token, key.getPublicKey(), { algorithms: ['RS256'] });

    // Validate issuer
    if (verifiedToken.iss !== 'https://auth.library.ucdavis.edu/realms/aggie-experts-miv') {
      return res.status(401).json({ error: 'Invalid token issuer' });
    }

    // Validate audience
    if (verifiedToken.aud !== 'account') {
      return res.status(401).json({ error: 'Invalid token audience' });
    }

    // Validate expiration
    if (Date.now() >= verifiedToken.exp * 1000) {
      return res.status(401).json({ error: 'Token has expired' });
    }

    // Validate request source (optional)
    //console.log('req', req.ip);
    //if (req.hostname !== verifiedToken.clientHost) {
    //  return res.status(401).json({ error: 'Invalid request source' });
    //}

    // Custom authorization logic
    // Implement your own logic here based on token claims
    if (! verifiedToken.resource_access.miv.roles.includes('access')) {
      return res.status(403).json({ error: 'No Access Role' });
    }
    next();

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function fetchExpertId (req, res, next) {
  if (req.query.email || req.query.ucdPersonUUID) {
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
//      console.log('ucdPersonUUID', ucdPersonUUID);
      user = await AdminClient.findOneByAttribute(`ucdPersonUUID:${ucdPersonUUID}`);
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send({error: 'Error finding expert with ${req.query}'});
  }

  if (user && user?.attributes?.expertId) {
    const expertId = Array.isArray(user.attributes.expertId) ? user.attributes.expertId[0] : user.attributes.expertId;
    req.query.expertId = expertId;
    return next();
  } else {
    return res.status(404).send({error: `No expert found`});
  }
}

router.get(
  '/user',
  validate_miv_client,
  // is_miv,
  validate_admin_client,
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
  validate_miv_client,
  has_access('miv'),
  // is_miv,
  validate_admin_client,
  fetchExpertId,
  async (req, res) => {
    const params = {};
    req.query.expert = `expert/${req.query.expertId}`;
    for (const key in template.script.params) {
      if (req.query[key]) {
        params[key] = req.query[key];
      } else {
        params[key] = template.script.params[key];
      }
    }
    params.expert = req.query.expert;

    opts = {
      id: template.id,
      params
    };
    try {
      await expert.verify_template(template);
      const find = await expert.search(opts);
      //jq '.hits[0]["_inner_hits"][0]| {"@id","title":.name,"end_date":.dateTimeInterval.end.dateTime,"start_date":.dateTimeInterval.start.dateTime,"grant_amount":.totalAwardAmount,"sponsor_id":.sponsorAwardId,"sponsor_name":.assignedBy.name,"type":.["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"].name,"role_label":(.relatedBy[] | select(.inheres_in) | .["@type"])}' new.json
      let grants = [];
      if (find?.hits[0]) {
        for (const hit of find.hits[0]._inner_hits) {
          // create a people array
          let people = [];
          if (hit.relatedBy) {
            hit.relatedBy.forEach((x) => {
              if (! x.inheres_in) {
                people.push({
                  '@id': x['@id'],
                  name: x.relates[0].name,
                  role: x['@type']
                });
              }
            });
          }
          grants.push({
            '@id': hit['@id'],
            title: hit.name,
            end_date: hit.dateTimeInterval.end.dateTime,
            start_date: hit.dateTimeInterval.start.dateTime,
            grant_amount: hit.totalAwardAmount,
            sponsor_id: hit.sponsorAwardId,
            sponsor_name: hit.assignedBy.name,
            type: hit['@type'],
            role_label: hit.relatedBy.find(x => x.inheres_in)['@type'],
            contributors: people
          });
        }
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
  fetchExpertId,
  async (req, res) => {
    const params = {};
    req.expert = `expert/${req.query.expertId}`;
    for (const key in template.script.params) {
      if (req.query[key]) {
        params[key] = req.query[key];
      } else {
        params[key] = template.script.params[key];
      }
    }
    params.expert = `expert/${req.query.expertId}`;

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
