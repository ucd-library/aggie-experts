import cache from '../../cache.js';
import PgClient from '../../pg-client.js';
import { config, logger } from '@ucd-lib/experts-commons';

function toBool(value, defaultValue=false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  const v = String(value).toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function hasType(node, type) {
  return asArray(node?.['@type']).includes(type);
}

function getSchemaName() {
  return process.env.MIV_PG_SCHEMA || process.env.MIV_POSTGRES_SCHEMA || 'miv';
}

function assertSchemaName(schema) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid postgres schema name: ${schema}`);
  }
}

function getPgConfig() {
  return {
    host: process.env.MIV_POSTGRES_HOST || config.postgres.host,
    port: process.env.MIV_POSTGRES_PORT || config.postgres.port,
    user: process.env.MIV_POSTGRES_USER || config.postgres.user,
    password: process.env.MIV_POSTGRES_PASSWORD || config.postgres.password,
    database: process.env.MIV_POSTGRES_DB || config.postgres.database
  };
}

function getExpertIdFromRole(role={}) {
  if (typeof role.inheres_in === 'string' && role.inheres_in.startsWith('expert/')) {
    return role.inheres_in;
  }

  for (const rel of asArray(role.relates)) {
    if (typeof rel === 'string' && rel.startsWith('expert/')) {
      return rel;
    }
  }

  return null;
}

function pickRoleType(role={}) {
  const types = asArray(role['@type']);
  return types[0] || null;
}

function toDateOrNull(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function toNumberOrNull(value) {
  if (value === undefined || value === null) return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function trimGrantTitle(title='') {
  if (typeof title !== 'string') return null;
  return title.split('§')[0].trim() || null;
}

async function readJson(path) {
  if (!path || !await cache.exists(path)) {
    return null;
  }

  return JSON.parse(await cache.read(path));
}

function getExpertNode(expertDoc={}) {
  return asArray(expertDoc['@graph']).find(node => hasType(node, 'Expert')) || null;
}

function getGrantNode(grantDoc={}) {
  return asArray(grantDoc['@graph']).find(node => hasType(node, 'Grant')) || null;
}

function buildExpertRecord({ user, metadata={}, expertDoc={} }) {
  const expertNode = getExpertNode(expertDoc) || {};
  const expertId = metadata.expertId ? `expert/${metadata.expertId}` : expertDoc['@id'];

  if (!expertId) {
    return null;
  }

  return {
    expert_id: expertId,
    email: expertNode?.contactInfo?.hasEmail || expertNode?.hasEmail || user || null,
    ucd_person_uuid: metadata?.ucdPersonUUID || null,
    iam_id: metadata?.iamId || null,
    display_name: expertNode?.name || expertNode?.contactInfo?.name || null
  };
}

function buildGrantRecord(grantDoc={}) {
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
    grant_types: asArray(grantNode['@type']).filter(t => typeof t === 'string')
  };
}

function buildGrantRoles(grantDoc={}) {
  const grantNode = getGrantNode(grantDoc);
  if (!grantNode) return [];

  return asArray(grantNode.relatedBy)
    .map(role => {
      const roleId = role?.['@id'];
      if (!roleId) return null;

      return {
        role_id: roleId,
        grant_id: grantNode['@id'],
        expert_id: getExpertIdFromRole(role),
        role_type: pickRoleType(role),
        role_name: role?.name || null,
        is_visible: role?.['is-visible'] === true,
        is_suppressed: role?.['ae-roleof-suppress'] === true
      };
    })
    .filter(Boolean)
    .filter(role => role.grant_id && role.role_type);
}

async function upsertExpert(client, schema, row) {
  await client.query(
    `INSERT INTO ${schema}.expert
      (expert_id, email, ucd_person_uuid, iam_id, display_name, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (expert_id)
     DO UPDATE SET
      email = EXCLUDED.email,
      ucd_person_uuid = EXCLUDED.ucd_person_uuid,
      iam_id = EXCLUDED.iam_id,
      display_name = EXCLUDED.display_name,
      updated_at = CURRENT_TIMESTAMP`,
    [row.expert_id, row.email, row.ucd_person_uuid, row.iam_id, row.display_name]
  );
}

async function upsertGrant(client, schema, row) {
  await client.query(
    `INSERT INTO ${schema}."grant"
      (grant_id, title, sponsor_id, sponsor_name, total_award_amount, start_date, end_date, status, raw_payload, grant_types, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
     ON CONFLICT (grant_id)
     DO UPDATE SET
      title = EXCLUDED.title,
      sponsor_id = EXCLUDED.sponsor_id,
      sponsor_name = EXCLUDED.sponsor_name,
      total_award_amount = EXCLUDED.total_award_amount,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      status = EXCLUDED.status,
      raw_payload = EXCLUDED.raw_payload,
      grant_types = EXCLUDED.grant_types,
      updated_at = CURRENT_TIMESTAMP`,
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
      row.grant_types
    ]
  );
}

async function replaceGrantRoles(client, schema, grantId, roles) {
  await client.query(`DELETE FROM ${schema}.grant_role WHERE grant_id = $1`, [grantId]);

  for (const role of roles) {
    await client.query(
      `INSERT INTO ${schema}.grant_role
        (role_id, grant_id, expert_id, role_type, role_name, is_visible, is_suppressed, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (role_id)
       DO UPDATE SET
        grant_id = EXCLUDED.grant_id,
        expert_id = EXCLUDED.expert_id,
        role_type = EXCLUDED.role_type,
        role_name = EXCLUDED.role_name,
        is_visible = EXCLUDED.is_visible,
        is_suppressed = EXCLUDED.is_suppressed,
        updated_at = CURRENT_TIMESTAMP`,
      [
        role.role_id,
        role.grant_id,
        role.expert_id,
        role.role_type,
        role.role_name,
        role.is_visible,
        role.is_suppressed
      ]
    );
  }
}

export function isMivPostgresLoadEnabled() {
  return toBool(process.env.MIV_POSTGRES_LOAD_ENABLED || process.env.MIV_PG_LOAD_ENABLED, false);
}

export async function loadMivPostgres({ user, metadata={}, files=[] }) {
  if (!isMivPostgresLoadEnabled()) return;

  const schema = getSchemaName();
  assertSchemaName(schema);

  const pgClient = new PgClient(getPgConfig(), schema);
  const expertFile = files.find(file => file.type === 'expert');
  const grantFiles = files.filter(file => file.type === 'grant');

  const expertDoc = await readJson(expertFile?.path);
  const expertRecord = buildExpertRecord({ user, metadata, expertDoc });

  if (!expertRecord?.expert_id) {
    logger.warn({ user }, 'MIV postgres load skipped - missing expert id');
    await pgClient.end();
    return;
  }

  try {
    await pgClient.query('BEGIN');

    await upsertExpert(pgClient, schema, expertRecord);

    for (const file of grantFiles) {
      const grantDoc = await readJson(file.path);
      if (!grantDoc) continue;

      const grantRecord = buildGrantRecord(grantDoc);
      if (!grantRecord?.grant_id) continue;

      await upsertGrant(pgClient, schema, grantRecord);
      await replaceGrantRoles(pgClient, schema, grantRecord.grant_id, buildGrantRoles(grantDoc));
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
  if (!isMivPostgresLoadEnabled() || !expertId) return;

  const schema = getSchemaName();
  assertSchemaName(schema);

  const pgClient = new PgClient(getPgConfig(), schema);

  try {
    await pgClient.query('BEGIN');

    await pgClient.query(`DELETE FROM ${schema}.grant_role WHERE expert_id = $1`, [expertId]);

    await pgClient.query(
      `DELETE FROM ${schema}."grant" g
       WHERE NOT EXISTS (
         SELECT 1 FROM ${schema}.grant_role gr WHERE gr.grant_id = g.grant_id
       )`
    );

    await pgClient.query(`DELETE FROM ${schema}.expert WHERE expert_id = $1`, [expertId]);

    await pgClient.query('COMMIT');
    logger.info({ expertId }, 'MIV postgres expert purge completed');
  } catch (error) {
    await pgClient.query('ROLLBACK');
    throw error;
  } finally {
    await pgClient.end();
  }
}
