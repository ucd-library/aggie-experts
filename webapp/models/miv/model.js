const { Pool } = require('pg');
const { config } = require('@ucd-lib/experts-commons');

function generateGrantFormattedDate() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(now.getTime() - tzOffsetMs);
  return localDate.toISOString().split('T')[0];
}

function assertSchema(schema) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid postgres schema name: ${schema}`);
  }
}

let mivPgPool;

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

function titleCaseWords(value='') {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getNameFromRoleId(roleId='') {
  const match = String(roleId || '').match(/#roleof_(.+)$/i);
  if (!match) return '';

  const decoded = decodeURIComponent(match[1]);
  return titleCaseWords(decoded.replace(/[_-]+/g, ' '));
}

function getContributorName(grant={}, role={}) {
  const fromDisplayName = cleanContributorName(role.display_name);
  if (fromDisplayName) return fromDisplayName;

  const relatedBy = Array.isArray(grant?.raw_payload?.relatedBy) ? grant.raw_payload.relatedBy : [];
  const matchingRole = relatedBy.find(item => item?.['@id'] === role.role_id);
  const fromPayload = cleanContributorName(matchingRole?.name);
  if (fromPayload) return fromPayload;

  return getNameFromRoleId(role.role_id);
}

function isPiRole(roleType='') {
  const value = String(roleType || '').trim();
  if (!value) return false;

  const short = value.includes('#') ? value.split('#').pop() : value;
  return short === 'PrincipalInvestigatorRole' ||
         short === 'CoPrincipalInvestigatorRole';
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
    '@type': (grant.grant_types || []).length === 1 ? grant.grant_types[0] : (grant.grant_types || []),
    status: grant.status,
    relatedBy: roles.map(role => {
      const types = normalizeGrantRoleTypes(role.role_type_uri);
      const expertId = role.expert_id ? `expert/${role.expert_id}` : null;
      const entry = {
        '@id': role.role_id,
        '@type': types.length === 1 ? types[0] : types,
        inheres_in: expertId,
        relates: [expertId, grant.grant_id].filter(Boolean)
      };
      if (role.is_visible) entry['is-visible'] = true;
      return entry;
    })
  });
}

function buildRawGrantResponse(grant, roles, expertId='') {
  if (grant?.raw_payload && typeof grant.raw_payload === 'object') {
    const payload = normalizeRawGrantDates(cloneJson(grant.raw_payload));
    payload.name = (payload.name || '').split('§')?.[0]?.trim() || payload.name;
    if (Array.isArray(payload['@type']) && payload['@type'].length === 1) {
      payload['@type'] = payload['@type'][0];
    }
    // Merge raw_payload.relatedBy with expert_grant_role rows:
    // - valid roles = expert_grant_role rows with a non-null expert_id (authoritative set)
    // - keep raw_payload entries whose @id is in the valid set (preserves all original fields)
    // - for valid roles missing from raw_payload, build entries from scratch
    // - preserve raw_payload entries not in the valid set — external contributors (#roleof_ stubs)
    //   and other linked experts not in the queried expert's expert_grant_role rows
    // Note: after harvest re-runs with resolveRoleExpertIds, previously-null stubs for known
    // experts (e.g. Peisert) will be resolved and move into validRoles automatically.
    const validRoles = roles.filter(r => r.expert_id);
    const validRoleIds = new Set(validRoles.map(r => r.role_id));
    // Get the queried expert's display name to exclude their unresolved stubs (#roleof_ entries
    // without inheres_in that haven't been resolved by harvest yet)
    const expertDisplayName = cleanContributorName(
      roles.find(r => r.expert_id === expertId)?.display_name || ''
    ).toLowerCase();
    const rawById = {};
    const nonExpertRawEntries = [];
    if (Array.isArray(payload.relatedBy)) {
      for (const r of payload.relatedBy) {
        if (!r['@id']) continue;
        rawById[r['@id']] = r;
        if (!validRoleIds.has(r['@id'])) {
          const rName = cleanContributorName(r.name).toLowerCase();
          if (!expertDisplayName || !rName || rName !== expertDisplayName) {
            nonExpertRawEntries.push(r);
          }
        }
      }
    }

    payload.relatedBy = [
      ...validRoles.map(role => {
        const raw = rawById[role.role_id];
        if (raw) {
          // Use the raw_payload entry as-is, just normalize is-visible and @type
          const out = { ...raw };
          if (!out['is-visible']) delete out['is-visible'];
          if (Array.isArray(out['@type']) && out['@type'].length === 1) {
            out['@type'] = out['@type'][0];
          }
          return out;
        }
        // No matching raw_payload entry — build from expert_grant_role data.
        // If this is the queried expert's role and there's exactly one null stub with a name,
        // use that name (the stub is a duplicate of this linked role with the display name).
        const types = normalizeGrantRoleTypes(role.role_type_uri);
        const roleExpertId = `expert/${role.expert_id}`;
        const entry = {
          '@id': role.role_id,
          '@type': types.length === 1 ? types[0] : types,
          inheres_in: roleExpertId,
          relates: [roleExpertId, grant.grant_id].filter(Boolean)
        };
        if (role.is_visible) entry['is-visible'] = true;
        return entry;
      }),
      ...nonExpertRawEntries.map(r => {
        const out = { ...r };
        if (!out['is-visible']) delete out['is-visible'];
        if (Array.isArray(out['@type']) && out['@type'].length === 1) {
          out['@type'] = out['@type'][0];
        }
        return out;
      })
    ];
    return payload;
  }

  return buildRawGrantFallback(grant, roles);
}

async function fetchMivPostgresGrants(expertId, since, until) {
  const schema = 'api';
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

  const rolesByGrant = new Map();
  for (const row of rolesResp.rows) {
    if (!rolesByGrant.has(row.grant_id)) rolesByGrant.set(row.grant_id, []);
    rolesByGrant.get(row.grant_id).push(row);
  }

  return { grants: grantsResp.rows, rolesByGrant };
}

module.exports = {
  generateGrantFormattedDate,
  assertSchema,
  getMivPgPool,
  cleanContributorName,
  titleCaseWords,
  getNameFromRoleId,
  getContributorName,
  isPiRole,
  normalizeGrantRoleTypes,
  formatDateToString,
  cloneJson,
  normalizeRawGrantDates,
  buildRawGrantFallback,
  buildRawGrantResponse,
  fetchMivPostgresGrants
};
