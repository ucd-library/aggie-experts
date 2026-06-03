/**
 * MIV postgres projection: grants + roles.
 *
 * Source: ae-std/rel/{relationshipUri}.jsonld for each grant the user has a
 * role on, plus webapp/expert.jsonld for the user identity.
 *
 * Target tables (all in the `api` schema):
 *   - "user"             (identity columns only — managed via ./user.js)
 *   - "grant"            (grant master data)
 *   - grant_type         (lookup, seeded by schema.sql, auto-grown if needed)
 *   - role_type          (lookup, shared with works)
 *   - expert_grant_role  (junction)
 */

import { logger } from '@ucd-lib/experts-commons';
import PgClient from '../pg-client.js';
import {
  asArray,
  hasType,
  jsonldBool,
  jsonldFirstValue,
  toShortType,
  toShortPrecision,
  toNumberOrNull,
  toDateOrNull,
  trimGrantTitle,
  normalizeExpertId,
  getExpertIdFromRole,
  pickRoleType,
  readJson,
  stripAeBase,
  getApiSchemaName,
  assertSchemaName,
  URI
} from '../pg-jsonld.js';
import { buildUserRecord, upsertUser } from './user.js';

// ----------------------------------------------------------------------------
// Grant builders (read a compacted/webapp-shape grant doc)
// ----------------------------------------------------------------------------

function getGrantNode(grantDoc={}) {
  return asArray(grantDoc['@graph']).find(node => hasType(node, 'Grant')) || null;
}

export function buildGrantRecord(grantDoc={}) {
  const grantNode = getGrantNode(grantDoc);
  if (!grantNode?.['@id']) return null;

  return {
    grant_id: grantNode['@id'],
    title: trimGrantTitle(grantNode.name) || grantNode.name || grantNode.title || null,
    sponsor_id: grantNode.sponsorAwardId || null,
    sponsor_name: grantNode?.assignedBy?.name || null,
    total_award_amount: toNumberOrNull(grantNode.totalAwardAmount),
    start_date: toDateOrNull(grantNode?.dateTimeInterval?.start?.dateTime),
    end_date: toDateOrNull(grantNode?.dateTimeInterval?.end?.dateTime),
    status: grantNode.status || null,
    raw_payload: grantNode,
    grant_type_uris: asArray(grantNode['@type']).filter(t => typeof t === 'string')
  };
}

export function buildGrantRoles(grantDoc={}) {
  const grantNode = getGrantNode(grantDoc);
  if (!grantNode) return [];

  return asArray(grantNode.relatedBy)
    .map(role => {
      const roleId = role?.['@id'];
      if (!roleId) return null;

      return {
        role_id: roleId,
        grant_id: grantNode['@id'],
        expert_id: normalizeExpertId(getExpertIdFromRole(role)),
        role_type_uri: pickRoleType(role),
        is_visible: role?.['is-visible'] === true
      };
    })
    .filter(Boolean)
    .filter(role => role.grant_id && role.role_type_uri);
}

// ----------------------------------------------------------------------------
// ae-std → webapp-shape grant doc normalizer
// ----------------------------------------------------------------------------

/**
 * @function normalizeAeStdGrantDoc
 * @description Converts an ae-std expanded JSON-LD array (from
 * ae-std/rel/*.jsonld) into the compacted `{ '@graph': [grantNode] }` shape
 * that buildGrantRecord / buildGrantRoles expect, resolving all internal
 * @id references along the way.
 *
 * If the input is already an object (e.g. a webapp-format grant doc from a
 * regenerated disassociated work), it is returned unchanged so the caller can
 * handle both formats.
 */
export function normalizeAeStdGrantDoc(aeStdData) {
  if (!Array.isArray(aeStdData)) return aeStdData;

  // lookup map for resolving @id references
  const nodeMap = {};
  for (const node of aeStdData) {
    if (node?.['@id']) nodeMap[node['@id']] = node;
  }

  // get grant node
  const grantNode = aeStdData.find(n => asArray(n['@type']).includes(URI.GRANT_TYPE));
  if (!grantNode) return null;

  // get assignedBy (funder node)
  const assignedById = asArray(grantNode[URI.ASSIGNED_BY])[0]?.['@id'];
  const assignedByNode = assignedById ? nodeMap[assignedById] : null;
  const assignedBy = assignedByNode
    ? {
        '@id': assignedByNode['@id'],
        '@type': toShortType(asArray(assignedByNode['@type'])[0]),
        name: jsonldFirstValue(assignedByNode, URI.SCHEMA_NAME)
      }
    : undefined;

  // get dateTimeInterval -> start / end date nodes
  const intervalId = asArray(grantNode[URI.DATE_TIME_INTERVAL])[0]?.['@id'];
  const intervalNode = intervalId ? nodeMap[intervalId] : null;
  let dateTimeInterval;
  if (intervalNode) {
    const startId = asArray(intervalNode[URI.DATE_TIME_START])[0]?.['@id'];
    const endId   = asArray(intervalNode[URI.DATE_TIME_END])[0]?.['@id'];
    const startNode = startId ? nodeMap[startId] : null;
    const endNode   = endId   ? nodeMap[endId]   : null;
    dateTimeInterval = {
      '@id': intervalNode['@id'],
      start: startNode ? {
        '@id': startNode['@id'],
        dateTime: jsonldFirstValue(startNode, URI.DATE_TIME),
        dateTimePrecision: toShortPrecision(jsonldFirstValue(startNode, URI.DATE_TIME_PRECISION))
      } : undefined,
      end: endNode ? {
        '@id': endNode['@id'],
        dateTime: jsonldFirstValue(endNode, URI.DATE_TIME),
        dateTimePrecision: toShortPrecision(jsonldFirstValue(endNode, URI.DATE_TIME_PRECISION))
      } : undefined
    };
  }

  // get relatedBy role refs (some may be inline objects, some just { @id } refs)
  const relatedBy = asArray(grantNode[URI.RELATED_BY]).map(ref => {
    // inline role objects have keys beyond just @id; pure refs have only @id
    const roleNode = (Object.keys(ref).length > 1) ? ref : nodeMap[ref['@id']];
    if (!roleNode) return { '@id': ref['@id'] };

    const roleName = jsonldFirstValue(roleNode, URI.SCHEMA_NAME);
    const inheresInId = asArray(roleNode[URI.RO_INHERES_IN])[0]?.['@id'];
    const inheresIn = inheresInId ? stripAeBase(inheresInId) : undefined;

    const relates = asArray(roleNode[URI.RELATES])
      .map(r => stripAeBase(r['@id'] || r))
      .filter(Boolean);

    return {
      '@id': roleNode['@id'],
      '@type': asArray(roleNode['@type']).map(toShortType),
      name: roleName,
      inheres_in: inheresIn,
      relates,
      'is-visible': jsonldBool(roleNode, URI.IS_VISIBLE, false)
    };
  });

  const rawIdentifiers = asArray(grantNode[URI.SCHEMA_IDENTIFIER]);
  const identifier = Array.from(new Set(rawIdentifiers
    .map(item => item?.['@id'] ?? item?.['@value'] ?? item)
    .filter(value => typeof value === 'string' && value.trim())
    .map(value => value.trim())));

  const rawTypes = asArray(grantNode['@type']);
  const shortTypes = rawTypes.map(toShortType);
  // Sort "Grant" to the end so the specific subtype (Grant_Research, …) wins
  const normalizedTypes = Array.from(new Set(shortTypes.filter(Boolean))).sort((a, b) => {
    if (a === 'Grant') return 1;
    if (b === 'Grant') return -1;
    return 0;
  });

  return {
    '@graph': [{
      '@id':            grantNode['@id'],
      '@type':          normalizedTypes,
      identifier,
      name:             jsonldFirstValue(grantNode, URI.SCHEMA_NAME),
      sponsorAwardId:   jsonldFirstValue(grantNode, URI.SPONSOR_AWARD_ID),
      totalAwardAmount: jsonldFirstValue(grantNode, URI.TOTAL_AWARD_AMOUNT),
      status:           jsonldFirstValue(grantNode, URI.CSL_STATUS),
      assignedBy,
      dateTimeInterval,
      relatedBy
    }]
  };
}

// ----------------------------------------------------------------------------
// Upserts
// ----------------------------------------------------------------------------

export async function upsertGrant(client, schema, row) {
  // Seed any new grant types we haven't seen before. (Schema.sql also seeds a
  // baseline set on initialization.)
  for (const grantTypeUri of row.grant_type_uris) {
    if (grantTypeUri) {
      await client.query(
        `INSERT INTO ${schema}.grant_type (uri, label)
         VALUES ($1, $1)
         ON CONFLICT (uri) DO NOTHING`,
        [grantTypeUri]
      );
    }
  }

  await client.query(
    `INSERT INTO ${schema}."grant"
      (grant_id, title, sponsor_id, sponsor_name, total_award_amount,
       start_date, end_date, status, raw_payload, grant_type_ids, last_seen_cdl)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
       ARRAY(SELECT grant_type_id FROM ${schema}.grant_type WHERE uri = ANY($10::text[])),
       CURRENT_TIMESTAMP)
     ON CONFLICT (grant_id)
     DO UPDATE SET
      title              = EXCLUDED.title,
      sponsor_id         = EXCLUDED.sponsor_id,
      sponsor_name       = EXCLUDED.sponsor_name,
      total_award_amount = EXCLUDED.total_award_amount,
      start_date         = EXCLUDED.start_date,
      end_date           = EXCLUDED.end_date,
      status             = EXCLUDED.status,
      raw_payload        = EXCLUDED.raw_payload,
      grant_type_ids     = EXCLUDED.grant_type_ids,
      last_seen_cdl      = CURRENT_TIMESTAMP`,
    [
      row.grant_id,
      row.title,
      row.sponsor_id,
      row.sponsor_name,
      row.total_award_amount,
      row.start_date,
      row.end_date,
      row.status,
      row.raw_payload,
      row.grant_type_uris
    ]
  );
}

export async function replaceGrantRoles(client, schema, grantId, roles, expertId) {
  // Delete this expert's roles and any orphaned rows with no expert linkage (NULL
  // expert_id), which come from old-style harvests before proper inheres_in mapping.
  await client.query(
    `DELETE FROM ${schema}.expert_grant_role WHERE grant_id = $1 AND (expert_id = $2 OR expert_id IS NULL)`,
    [grantId, expertId]
  );

  // Seed any new role types we haven't seen before.
  for (const role of roles) {
    if (role.role_type_uri) {
      await client.query(
        `INSERT INTO ${schema}.role_type (uri, label)
         VALUES ($1, $1)
         ON CONFLICT (uri) DO NOTHING`,
        [role.role_type_uri]
      );
    }
  }

  for (const role of roles) {
    await client.query(
      `INSERT INTO ${schema}.expert_grant_role
        (role_id, grant_id, expert_id, role_type_id, is_visible, last_seen_cdl)
       VALUES ($1, $2, $3,
         (SELECT role_type_id FROM ${schema}.role_type WHERE uri = $4),
         $5, CURRENT_TIMESTAMP)
       ON CONFLICT (role_id)
       DO UPDATE SET
        grant_id      = EXCLUDED.grant_id,
        expert_id     = EXCLUDED.expert_id,
        role_type_id  = EXCLUDED.role_type_id,
        is_visible    = EXCLUDED.is_visible,
        last_seen_cdl = CURRENT_TIMESTAMP`,
      [
        role.role_id,
        role.grant_id,
        role.expert_id,
        role.role_type_uri,
        role.is_visible
      ]
    );
  }
}

// ----------------------------------------------------------------------------
// Public entry points
// ----------------------------------------------------------------------------

export async function loadMivPostgres({ user, metadata={}, files=[] }) {
  const schema = getApiSchemaName();
  assertSchemaName(schema);

  const pgClient = new PgClient();
  const expertFile = files.find(file => file.type === 'expert');
  const grantFiles = files.filter(file => file.type === 'grant');

  const expertDoc = await readJson(expertFile?.path);
  const userRecord = buildUserRecord({ user, metadata, expertDoc });

  if (!userRecord?.expert_id || !userRecord?.email) {
    logger.warn({ user }, 'MIV postgres load skipped - missing user/expert identity');
    await pgClient.end();
    return;
  }

  try {
    await pgClient.query('BEGIN');

    await upsertUser(pgClient, schema, userRecord);

    for (const file of grantFiles) {
      let grantDoc = await readJson(file.path);
      if (!grantDoc) continue;

      // ae-std rel files are JSON arrays; normalize to the compacted shape
      // buildGrantRecord expects.
      if (Array.isArray(grantDoc)) {
        grantDoc = normalizeAeStdGrantDoc(grantDoc);
        if (!grantDoc) continue;
      }

      const grantRecord = buildGrantRecord(grantDoc);
      if (!grantRecord?.grant_id) continue;

      await upsertGrant(pgClient, schema, grantRecord);
      await replaceGrantRoles(pgClient, schema, grantRecord.grant_id, buildGrantRoles(grantDoc), userRecord.expert_id);
    }

    await pgClient.query('COMMIT');
    logger.info({ user, grantCount: grantFiles.length }, 'MIV postgres load completed');
  } catch (error) {
    await pgClient.query('ROLLBACK');
    throw error;
  } finally {
    await pgClient.end();
  }
}

export async function purgeMivPostgresExpert(expertId) {
  if (!expertId) return;

  const schema = getApiSchemaName();
  assertSchemaName(schema);

  const pgClient = new PgClient();
  const normalizedExpertId = normalizeExpertId(expertId);
  if (!normalizedExpertId) return;

  try {
    await pgClient.query('BEGIN');

    await pgClient.query(
      `DELETE FROM ${schema}.expert_grant_role WHERE expert_id = $1`,
      [normalizedExpertId]
    );

    // Remove orphaned grants (no more roles point at them)
    await pgClient.query(
      `DELETE FROM ${schema}."grant" g
       WHERE NOT EXISTS (
         SELECT 1 FROM ${schema}.expert_grant_role gr WHERE gr.grant_id = g.grant_id
       )`
    );

    // Clear identity columns. Profile columns are managed by purgeSitefarmPostgresExpert.
    await pgClient.query(
      `UPDATE ${schema}."user"
       SET expert_id       = NULL,
           ucd_person_uuid = NULL,
           iam_id          = NULL,
           display_name    = NULL,
           last_seen_cdl   = CURRENT_TIMESTAMP
       WHERE expert_id = $1`,
      [normalizedExpertId]
    );

    await pgClient.query('COMMIT');
    logger.info({ expertId }, 'MIV postgres expert purge completed');
  } catch (error) {
    await pgClient.query('ROLLBACK');
    throw error;
  } finally {
    await pgClient.end();
  }
}
