// Routes for the MIV API
const router = require('express').Router();
const ExpertModel = require('../expert/model.js');
const utils = require('../utils.js')
const template = require('./template/miv_grants.json');
const { Pool } = require('pg');
const { config } = require('@ucd-lib/experts-commons');
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

// TODO move config/model stuff out of this api file, just rough poc start

let mivPgPool;

function assertSchema(schema) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid postgres schema name: ${schema}`);
  }
}

function getMivPgPool() {
  if (mivPgPool) return mivPgPool;

  mivPgPool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    user: config.postgres.user,
    password: config.postgres.password,
    database: config.postgres.database
  });

  return mivPgPool;
}

function cleanContributorName(name='') {
  if (Array.isArray(name)) name = name[0] || '';
  return String(name || '').replace(/\b(?:COPI|PI):\s*/gi, '').trim();
}

function isPiRole(roleType='') {
  return roleType === 'http://vivoweb.org/ontology/core#PrincipalInvestigatorRole' ||
         roleType === 'http://vivoweb.org/ontology/core#CoPrincipalInvestigatorRole';
}

function normalizeGrantRoleTypes(roleType) {
  const out = new Set();

  if (Array.isArray(roleType)) {
    roleType.filter(Boolean).forEach(t => out.add(t));
  } else if (roleType) {
    out.add(roleType);
  }

  out.add('GrantRole');
  return Array.from(out);
}

function formatDateToString(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return date;
}

function cloneJson(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeRawGrantDates(grant={}) {
  if (grant?.dateTimeInterval?.start) {
    grant.dateTimeInterval.start.dateTime = formatDateToString(grant.dateTimeInterval.start.dateTime);
  }

  if (grant?.dateTimeInterval?.end) {
    grant.dateTimeInterval.end.dateTime = formatDateToString(grant.dateTimeInterval.end.dateTime);
  }

  return grant;
}

function buildRawGrantFallback(grant, roles) {
  return normalizeRawGrantDates({
    '@id': grant.grant_id,
    identifier: [grant.grant_id],
    name: grant.title,
    dateTimeInterval: {
      '@id': `${grant.grant_id}#interval`,
      start: {
        '@id': `${grant.grant_id}#start_date`,
        dateTime: formatDateToString(grant.start_date),
        dateTimePrecision: 'vivo:yearMonthDayPrecision'
      },
      end: {
        '@id': `${grant.grant_id}#end_date`,
        dateTime: formatDateToString(grant.end_date),
        dateTimePrecision: 'vivo:yearMonthDayPrecision'
      }
    },
    totalAwardAmount: grant.total_award_amount,
    sponsorAwardId: grant.sponsor_id,
    assignedBy: {
      '@id': `${grant.grant_id}#funder`,
      '@type': 'FundingOrganization',
      name: grant.sponsor_name
    },
    '@type': grant.grant_types || [],
    status: grant.status,
    relatedBy: roles.map(role => ({
      '@id': role.role_id,
      '@type': normalizeGrantRoleTypes(role.role_type_uri),
      inheres_in: role.expert_id,
      relates: [role.expert_id, grant.grant_id].filter(Boolean),
      'is-visible': role.is_visible
    }))
  });
}

function buildRawGrantResponse(grant, roles) {
  if (grant?.raw_payload && typeof grant.raw_payload === 'object') {
    const payload = normalizeRawGrantDates(cloneJson(grant.raw_payload));
    payload.name = (payload.name || '').split('§')?.[0]?.trim() || payload.name;
    return payload;
  }

  return buildRawGrantFallback(grant, roles);
}

async function fetchMivPostgresGrants(expertId, since, until) {
  const schema = 'etl_reporting';
  assertSchema(schema);
  const pool = getMivPgPool();
  const normalizedExpertId = String(expertId || '').replace(/^expert\//, '');
  const expertIdCandidates = [normalizedExpertId, `expert/${normalizedExpertId}`];

  const grantsResp = await pool.query(
    `WITH my_roles AS (
      SELECT egr.grant_id, rt.uri AS role_type_uri
      FROM ${schema}.expert_grant_role egr
      JOIN ${schema}.role_type rt ON rt.role_type_id = egr.role_type_id
      WHERE egr.expert_id = ANY($1::text[])
    )
    SELECT
      g.grant_id,
      g.title,
      g.end_date,
      g.start_date,
      g.total_award_amount,
      g.status,
      g.raw_payload,
      g.sponsor_id,
      g.sponsor_name,
      ARRAY(SELECT gt.uri FROM ${schema}.grant_type gt WHERE gt.grant_type_id = ANY(g.grant_type_ids)) AS grant_types,
      array_agg(DISTINCT mr.role_type_uri) AS role_label
    FROM ${schema}."grant" g
    JOIN my_roles mr ON mr.grant_id = g.grant_id
    WHERE ($2::date IS NULL OR COALESCE(g.end_date, g.start_date, $3::date) >= $2::date)
      AND ($3::date IS NULL OR COALESCE(g.start_date, g.end_date, $2::date) <= $3::date)
    GROUP BY g.grant_id, g.title, g.end_date, g.start_date, g.total_award_amount, g.status, g.raw_payload, g.sponsor_id, g.sponsor_name, g.grant_type_ids
    ORDER BY g.start_date DESC NULLS LAST, g.grant_id`,
    [expertIdCandidates, since || null, until || null]
  );

  console.log('Fetched grants:', grantsResp.rowCount, JSON.stringify(grantsResp.rows, null, 2));

  const grantIds = grantsResp.rows.map(row => row.grant_id);
  if (!grantIds.length) {
    return { grants: [], rolesByGrant: new Map() };
  }

  const rolesResp = await pool.query(
    `SELECT
      gr.grant_id,
      gr.role_id,
      gr.expert_id,
      rt.uri AS role_type_uri,
      gr.is_visible,
      u.display_name
    FROM ${schema}.expert_grant_role gr
    JOIN ${schema}.role_type rt ON rt.role_type_id = gr.role_type_id
    LEFT JOIN ${schema}."user" u ON u.expert_id = gr.expert_id
    WHERE gr.grant_id = ANY($1::text[])
    ORDER BY gr.grant_id, gr.role_id`,
    [grantIds]
  );

  console.log('Fetched roles:', rolesResp.rowCount, JSON.stringify(rolesResp.rows, null, 2));

  const rolesByGrant = new Map();
  for (const row of rolesResp.rows) {
    if (!rolesByGrant.has(row.grant_id)) rolesByGrant.set(row.grant_id, []);
    rolesByGrant.get(row.grant_id).push(row);
  }

  return { grants: grantsResp.rows, rolesByGrant };
}

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

    try {
      const { grants, rolesByGrant } = await fetchMivPostgresGrants(expertId, since, until);

      const out = grants.map(grant => {
        const roles = rolesByGrant.get(grant.grant_id) || [];
        const contributors = roles
          .filter(role => role.expert_id !== expertId && role.expert_id !== `expert/${expertId}`)
          .filter(role => isPiRole(role.role_type_uri))
          .map(role => ({
            '@id': role.role_id,
            name: cleanContributorName(role.display_name || role.role_name),
            role: role.role_type
          }));

        const roleLabel = Array.from(
          new Set(
            (grant.role_label || [])
              .flatMap(normalizeGrantRoleTypes)
              .filter(Boolean)
          )
        );

        return {
          '@id': grant.grant_id,
          title: (grant.title || '').split('§')?.[0]?.trim() || grant.title,
          end_date: formatDateToString(grant.end_date),
          start_date: formatDateToString(grant.start_date),
          grant_amount: grant.total_award_amount,
          sponsor_id: grant.sponsor_id,
          sponsor_name: grant.sponsor_name,
          type: grant.grant_types || [],
          role_label: roleLabel,
          contributors
        };
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

    try {
      const { grants, rolesByGrant } = await fetchMivPostgresGrants(expertId, since, until);

      const out = grants.map(grant => buildRawGrantResponse(grant, rolesByGrant.get(grant.grant_id) || []));

      res.send(out);
    } catch (err) {
      console.error(err);
      res.status(400).send(err);
    }
  }
);

module.exports = router;
