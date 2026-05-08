// Routes for the MIV API
const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/miv_grants.json');
const expert = new ExpertModel();

const { has_access, fetchExpertId } = require('../middleware/index.js')

router.get(
  '/user',
  has_access('miv'),
  // is_miv,
  fetchExpertId,
  async (req, res) => {
    const expertId = req.expertId;
    try {
      res.send(expertId);
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
    }
  }
);

function generateGrantFormattedDate() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(now.getTime() - tzOffsetMs);
  return localDate.toISOString().split('T')[0];
}

const path = require('path');

router.get(
  '/grants',
  has_access('miv'),
  fetchExpertId,
  async (req, res) => {
    const params = {};

    // default to today unless an until date is provided to filter results
    const until = req.query.until || generateGrantFormattedDate();
    
    for (const key in template.script.params) {
      if (req.query[key]) {
        params[key] = req.query[key];
      } else {
        params[key] = template.script.params[key];
      }
    }
    
    // Override with actual expert ID (Express 5: can't mutate req.query)
    params.expert = `expert/${req.expertId}`;
    params.until = until;

    if( req.query['previewEsIndex'] ) {
      params.index = [
        'grants-'+req.query['previewEsIndex'],
        'experts-'+req.query['previewEsIndex'],
        'works-'+req.query['previewEsIndex']
      ]
    }
    
    opts = {
      id: template.id,
      params
    };

    try {
      await expert.verify_template(template);
      const find = await expert.search(opts);
      //jq '.hits[0]["_inner_hits"][0]| {"@id","title":.name,"end_date":.dateTimeInterval.end.dateTime,"start_date":.dateTimeInterval.start.dateTime,"grant_amount":.totalAwardAmount,"sponsor_id":.sponsorAwardId,"sponsor_name":.assignedBy.name,"type":.["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"].name,"role_label":(.relatedBy[] | select(.inheres_in) | .["@type"])}' new.json

      let grants = [];
      let expertId = find?.hits?.[0]?.['@id'] || '';
      if (find?.hits[0]) {
        for (const hit of find.hits[0]._inner_hits) {
          // Util function to ensure an array
          function ensureArray(value) {
            if (!Array.isArray(value)) {
              return [value];
            }
            return value;
          }

          // create a people array
          let people = [];
          if (hit.relatedBy) {
            hit.relatedBy.forEach((x) => {
              // filter to only other experts
              // Require @type to skip dangling {@id} stubs left over from
              // harvest-time #roleof_ drops.
              if( ( !x.inheres_in || x.inheres_in !== expertId ) && x['@type'] ) {
                let name = x.name || '';
                if( Array.isArray(name) ) name = name[0] || '';
                name = name.replace(/\b(?:COPI|PI):\s*/gi, '').trim();

                if (ensureArray(x['@type']).includes('PrincipalInvestigatorRole')) {
                  people.push({
                    '@id': x['@id'],
                    name,
                    role: 'PrincipalInvestigatorRole'
                  });
                } else if (ensureArray(x['@type']).includes('CoPrincipalInvestigatorRole')) {
                  people.push({
                    '@id': x['@id'],
                    name,
                    role: 'CoPrincipalInvestigatorRole'
                  });
                }
              }
            });
          }

          let role_label = hit.relatedBy?.find(x => x.inheres_in === expertId && x.relates.includes(expertId))?.['@type'] || '';

          // trim to just the name
          hit.name = (hit.name || '').split('§')?.[0]?.trim() || hit.name;

          grants.push({
            '@id': hit['@id'],
            title: hit.name,
            end_date: hit.dateTimeInterval.end.dateTime,
            start_date: hit.dateTimeInterval.start.dateTime,
            grant_amount: hit.totalAwardAmount,
            sponsor_id: hit.sponsorAwardId,
            sponsor_name: hit.assignedBy.name,
            type: hit['@type'],
            role_label,
            contributors: people
          });
        }
      }
      res.send({ "@graph": grants });
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
  has_access('miv'),
  fetchExpertId,
  async (req, res) => {
    const params = {};
    
    // default to today unless an until date is provided to filter results
    const until = req.query.until || generateGrantFormattedDate();
    
    for (const key in template.script.params) {
      if (req.query[key]) {
        params[key] = req.query[key];
      } else {
        params[key] = template.script.params[key];
      }
    }
    
    // Override with actual expert ID (Express 5: can't mutate req.query)
    params.expert = `expert/${req.expertId}`;
    params.until = until;

    if( req.query['previewEsIndex'] ) {
      params.index = [
        'grants-'+req.query['previewEsIndex'],
        'experts-'+req.query['previewEsIndex'],
        'works-'+req.query['previewEsIndex']
      ]
    }

    opts = {
      id: template.id,
      params
    };
    try {
      await expert.verify_template(template);
      const find = await expert.search(opts);
      let grants = [];
      if (find?.hits && find.hits[0] && Array.isArray(find.hits[0]._inner_hits)) {
        for (const hit of find.hits[0]._inner_hits) {
          // trim to just the name
          hit.name = (hit.name || '').split('§')?.[0]?.trim() || hit.name;
          grants.push(hit);
        }
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
