const { Pool } = require('pg');
const { config } = require('@ucd-lib/experts-commons');

function assertSchema(schema) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid postgres schema name: ${schema}`);
  }
}

let sitefarmPgPool;

function getSitefarmPgPool() {
  if (sitefarmPgPool) return sitefarmPgPool;

  sitefarmPgPool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    user: config.postgres.user,
    password: config.postgres.password,
    database: config.postgres.database
  });

  return sitefarmPgPool;
}

function normalizeExpertId(id='') {
  return String(id || '').trim().replace(/^expert\//, '');
}

function formatModifiedDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts.toISOString();
  return String(ts);
}

function ensureArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Query the api schema tables for the sitefarm API response.
 *
 * @param {string[]} expertIds  - bare expert ids (without "expert/" prefix)
 * @param {string|null} modifiedSince - YYYY-MM-DD; filters experts whose
 *   last_seen_cdl is >= this date. Null = no filter (returns all matching ids).
 *
 * Returns a map keyed by expert_id with { expert, works, rolesByWork }.
 * The route handler shapes the final response.
 */
async function fetchSitefarmPostgresExperts(expertIds, modifiedSince) {
  const schema = 'api';
  assertSchema(schema);

  const pool = getSitefarmPgPool();
  const ids = ensureArray(expertIds).map(normalizeExpertId).filter(Boolean);

  // Expert query: every requested id whose last_seen_cdl passes the modified_since gate.
  // If the caller passed no ids, we return nothing — sitefarm requires explicit ids.
  if (!ids.length) {
    return new Map();
  }

  const expertsResp = await pool.query(
    `SELECT
       u.expert_id,
       u.display_name,
       u.orcid_id,
       u.researcher_id,
       u.scopus_ids,
       u.overview,
       u.research_interests,
       u.contact_info,
       u.expert_raw_payload,
       u.last_seen_cdl
     FROM ${schema}."user" u
     WHERE u.expert_id = ANY($1::text[])
       AND ($2::date IS NULL OR u.last_seen_cdl::date >= $2::date)`,
    [ids, modifiedSince || null]
  );

  if (!expertsResp.rows.length) {
    return new Map();
  }

  const expertsById = new Map();
  for (const row of expertsResp.rows) {
    expertsById.set(row.expert_id, { expert: row, works: [], rolesByWork: new Map() });
  }

  // Top-5 works per expert, ordered by issued_date desc then title asc.
  // We use a windowed CTE so the LIMIT applies per expert rather than across all.
  const presentIds = Array.from(expertsById.keys());

  const worksResp = await pool.query(
    `WITH ranked AS (
       SELECT
         wr.expert_id,
         w.work_id,
         w.title,
         w.issued,
         w.issued_date,
         w.container_title,
         w.volume,
         w.page,
         w.doi,
         w.abstract,
         w.status,
         w.raw_payload,
         ARRAY(SELECT wt.uri FROM ${schema}.work_type wt WHERE wt.work_type_id = ANY(w.work_type_ids)) AS work_types,
         ROW_NUMBER() OVER (
           PARTITION BY wr.expert_id
           ORDER BY w.issued_date DESC NULLS LAST, w.title ASC NULLS LAST
         ) AS rn
       FROM ${schema}.expert_work_role wr
       JOIN ${schema}."work" w ON w.work_id = wr.work_id
       WHERE wr.expert_id = ANY($1::text[])
         AND wr.is_visible = true
     )
     SELECT * FROM ranked WHERE rn <= 5
     ORDER BY expert_id, rn`,
    [presentIds]
  );

  // Collect all (expert, work) pairs we'll need roles for.
  const workIds = new Set();
  for (const row of worksResp.rows) {
    const bucket = expertsById.get(row.expert_id);
    if (!bucket) continue;
    bucket.works.push(row);
    workIds.add(row.work_id);
  }

  if (workIds.size) {
    const rolesResp = await pool.query(
      `SELECT
         wr.work_id,
         wr.role_id,
         wr.expert_id,
         rt.uri AS role_type_uri,
         wr.is_visible,
         wr.is_favourite,
         wr.author_rank,
         wr.raw_payload
       FROM ${schema}.expert_work_role wr
       JOIN ${schema}.role_type rt ON rt.role_type_id = wr.role_type_id
       WHERE wr.work_id = ANY($1::text[])
       ORDER BY wr.work_id, wr.author_rank NULLS LAST, wr.role_id`,
      [Array.from(workIds)]
    );

    for (const row of rolesResp.rows) {
      // Roles attach per-work; we copy them into every expert bucket that has
      // this work (typically the queried expert, but a co-authored work may
      // appear under multiple experts if the caller passed several).
      for (const bucket of expertsById.values()) {
        if (!bucket.works.some(w => w.work_id === row.work_id)) continue;
        const map = bucket.rolesByWork;
        if (!map.has(row.work_id)) map.set(row.work_id, []);
        map.get(row.work_id).push(row);
      }
    }
  }

  return expertsById;
}

/**
 * Shape a single expert+works bucket from fetchSitefarmPostgresExperts() into
 * the response format the sitefarm clients expect — same fields as
 * siteFarmFormat() in api.js produces for the elasticsearch path.
 */
function buildSitefarmExpertResponse(expertId, bucket) {
  const { expert, works, rolesByWork } = bucket;
  // Use the short `expert/{id}` form — matches what the ES sitefarm path emits
  // (the ae-std person.jsonld carries the full URI, but consumers expect short).
  const expertUri = `expert/${expert.expert_id}`;

  // Contact info: bring back exactly the shape sitefarm consumed before.
  // contact_info JSONB already holds preferred block + hasURL list (built by
  // the loader's normalizeAeStdPersonDoc); just defensively normalize hasURL
  // to an array.
  const contactInfo = expert.contact_info ? { ...expert.contact_info } : {};
  if (contactInfo.hasURL && !Array.isArray(contactInfo.hasURL)) {
    contactInfo.hasURL = [contactInfo.hasURL];
  }
  if (Array.isArray(contactInfo.hasURL)) {
    contactInfo.hasURL = contactInfo.hasURL.map(url => {
      if (url && url['@type'] && !Array.isArray(url['@type'])) {
        return { ...url, '@type': [url['@type']] };
      }
      return url;
    });
  }
  if (!('hasURL' in contactInfo)) contactInfo.hasURL = null;

  // Publications: shape each work like the ES path's siteFarmFormat does.
  // Prefer the stored raw_payload (full ae-std work node) when present so
  // downstream consumers see the same fields they always have.
  const publications = works.map(workRow => {
    const base = workRow.raw_payload && typeof workRow.raw_payload === 'object'
      ? JSON.parse(JSON.stringify(workRow.raw_payload))
      : {
          '@id':            workRow.work_id,
          '@type':          workRow.work_types || [],
          title:            workRow.title,
          issued:           workRow.issued,
          'container-title': workRow.container_title,
          volume:           workRow.volume,
          page:             workRow.page,
          DOI:              workRow.doi,
          abstract:         workRow.abstract,
          status:           workRow.status
        };

    // Build relatedBy from expert_work_role rows so the favourite flag and
    // visibility match postgres truth. Filter to relationships that include
    // this expert in `relates` — same rule the ES siteFarmFormat applies.
    const roles = rolesByWork.get(workRow.work_id) || [];
    base.relatedBy = roles
      .map(role => {
        const payload = role.raw_payload && typeof role.raw_payload === 'object'
          ? JSON.parse(JSON.stringify(role.raw_payload))
          : null;

        if (payload) {
          payload['@id'] = role.role_id;
          payload['is-visible'] = role.is_visible;
          payload['ucdlib:favourite'] = role.is_favourite === true;
          return payload;
        }

        return {
          '@id': role.role_id,
          '@type': role.role_type_uri ? [role.role_type_uri.split('#').pop()] : [],
          relates: [role.expert_id].filter(Boolean),
          'is-visible': role.is_visible,
          'ucdlib:favourite': role.is_favourite === true
        };
      })
      .filter(rel => {
        const relates = ensureArray(rel.relates);
        return relates.includes(expertId)
          || relates.includes(expertUri)
          || relates.includes(`expert/${expertId}`);
      });

    // Normalize author to always be an array (matches ES path behavior)
    if (base.author !== undefined && !Array.isArray(base.author)) {
      base.author = [base.author];
    }

    return base;
  });

  const overview = expert.overview || '';
  const researchInterests = expert.research_interests || '';

  // Collapse single-value scopus_ids to a scalar (matches what ES emits via
  // JSON-LD compaction); leave multi-value as an array.
  const scopusIds = Array.isArray(expert.scopus_ids) ? expert.scopus_ids : [];
  let scopusId;
  if (scopusIds.length === 1) scopusId = scopusIds[0];
  else if (scopusIds.length > 1) scopusId = scopusIds;
  // else undefined → field omitted

  return {
    '@id': expertUri,
    publications,
    contactInfo,
    orcidId: expert.orcid_id || undefined,
    researcherId: expert.researcher_id || undefined,
    scopusId,
    overview: overview + (overview && researchInterests ? ' ' : '') + researchInterests,
    'modified-date': formatModifiedDate(expert.last_seen_cdl)
  };
}

module.exports = {
  assertSchema,
  getSitefarmPgPool,
  fetchSitefarmPostgresExperts,
  buildSitefarmExpertResponse
};
