// Routes for the MIV API
const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/miv_grants.json');
const expert = new ExpertModel();

const { has_access, fetchExpertId } = require('../middleware/index.js')
const {
  generateGrantFormattedDate,
  fetchMivPostgresGrants,
  buildRawGrantResponse,
  getContributorName,
  cleanContributorName,
  isPiRole,
  normalizeGrantRoleTypes,
  formatDateToString
} = require('./model.js');

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

router.get(
  '/grants_pg',
  has_access('miv'),
  fetchExpertId,
  async (req, res) => {
    const since = req.query.since || null;
    const until = req.query.until || generateGrantFormattedDate();
    const expertId = String(req.expertId || '').trim();
    const normalizedExpertId = expertId.replace(/^expert\//, '');

    try {
      const { grants, rolesByGrant } = await fetchMivPostgresGrants(expertId, since, until);

      const out = grants.map(grant => {
        const roles = rolesByGrant.get(grant.grant_id) || [];

        const linkedRoleIds = new Set(
          roles.filter(r => r.expert_id).map(r => r.role_id)
        );

        const linkedContributors = roles
          .filter(role => role.expert_id && role.expert_id !== normalizedExpertId)
          .filter(role => isPiRole(role.role_type_uri))
          .map(role => {
            const name = String(getContributorName(grant, role) || '').trim();
            if (!name) return null;
            return { '@id': role.role_id, name, role: role.role_type_uri };
          })
          .filter(Boolean);

        const rawRelatedBy = Array.isArray(grant.raw_payload?.relatedBy) ? grant.raw_payload.relatedBy : [];
        const rawContributors = rawRelatedBy
          .filter(r => r['@id'] && !linkedRoleIds.has(r['@id']))
          .filter(r => r.inheres_in !== `expert/${normalizedExpertId}`)
          .filter(r => [].concat(r['@type'] || []).some(t => isPiRole(t)))
          .map(r => {
            const name = cleanContributorName(r.name);
            if (!name) return null;
            return { '@id': r['@id'], name, role: [].concat(r['@type'] || [])[0] };
          })
          .filter(Boolean);

        const contributors = [...linkedContributors, ...rawContributors];

        const roleLabel = Array.from(
          new Set(
            (grant.role_label || [])
              .flatMap(normalizeGrantRoleTypes)
              .filter(Boolean)
          )
        );

        const row = {
          '@id': grant.grant_id,
          title: (grant.title || '').split('§')?.[0]?.trim() || grant.title,
          end_date: formatDateToString(grant.end_date),
          start_date: formatDateToString(grant.start_date),
          grant_amount: grant.total_award_amount,
          type: (grant.grant_types || []).length === 1 ? grant.grant_types[0] : (grant.grant_types || []),
          role_label: roleLabel,
          contributors
        };

        if (grant.sponsor_id !== null && grant.sponsor_id !== undefined && grant.sponsor_id !== '') {
          row.sponsor_id = grant.sponsor_id;
        }

        if (grant.sponsor_name !== null && grant.sponsor_name !== undefined && grant.sponsor_name !== '') {
          row.sponsor_name = grant.sponsor_name;
        }

        return row;
      });

      res.send({ '@graph': out });
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
    }
  }
);

router.get(
  '/raw_grants_pg',
  has_access('miv'),
  fetchExpertId,
  async (req, res) => {
    const since = req.query.since || null;
    const until = req.query.until || generateGrantFormattedDate();
    const expertId = String(req.expertId || '').trim();
    const normalizedExpertId = expertId.replace(/^expert\//, '');

    try {
      const { grants, rolesByGrant } = await fetchMivPostgresGrants(expertId, since, until);
      const out = grants.map(grant => buildRawGrantResponse(grant, rolesByGrant.get(grant.grant_id) || [], normalizedExpertId));
      res.send(out);
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
    }
  }
);

module.exports = router;
