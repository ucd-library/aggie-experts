import cache from '../cache.js';
import { config, logger } from '@ucd-lib/experts-commons';
import { Temporal } from '@js-temporal/polyfill';
import { getYearWeek } from '@ucd-lib/experts-commons';
import PgClient from '../pg-client.js';

const WEEK_YEAR_START = 2026;
const WEEK_YEAR_END = WEEK_YEAR_START + 20;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// function reportFileWrite(opts={}) {
//   if( !config?.reporting?.enabled ) {
//     return;
//   }
//   opts.command_id = config.reporting.commandId;
//   return config.postgres.client.insertFileCacheOp(opts);
// }

async function initYearWeek(pgClient) {
  let weekYearInfo = getYearWeek({allValues: true});
  let date = new Temporal.PlainDate(WEEK_YEAR_START, 1, 1);
  let endDate = new Temporal.PlainDate(WEEK_YEAR_END+1, 1, 1);

  while( Temporal.PlainDate.compare(date, endDate) < 0 ) {
    weekYearInfo = getYearWeek({date, allValues: true, asString: true});
    await pgClient.insertYearWeek(
      weekYearInfo.yearWeek,
      weekYearInfo.weekStart,
      weekYearInfo.weekEnd
    );
    date = date.add({ days: 7 });
  }
}

function captureError(error) {  
  return config.postgres.client.insertError({
    message : error.message,
    stack : error.stack,
    command_id : config.reporting.commandId
  });
}

function updateEsIndex(alias, indexName, docCount) {
  return config.postgres.client.updateEsIndex(alias, indexName, docCount);
}

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

function normalizeExpertId(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('expert/')) {
    return trimmed.slice('expert/'.length);
  }

  if (trimmed.startsWith('http://experts.ucdavis.edu/expert/')) {
    return trimmed.slice('http://experts.ucdavis.edu/expert/'.length);
  }

  if (trimmed.startsWith('info:fedora/expert/')) {
    return trimmed.slice('info:fedora/expert/'.length);
  }

  return trimmed;
}

function getSchemaName() {
  return 'etl_reporting';
}

function assertSchemaName(schema) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid postgres schema name: ${schema}`);
  }
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

function buildUserRecord({ user, metadata={}, expertDoc={} }) {
  const expertNode = getExpertNode(expertDoc) || {};
  const expertId = normalizeExpertId(metadata.expertId || expertDoc['@id']);
  const email = expertNode?.contactInfo?.hasEmail || expertNode?.hasEmail || user || null;

  if (!expertId || !email) {
    return null;
  }

  return {
    email,
    expert_id: expertId,
    ucd_person_uuid: metadata?.ucdPersonUUID || null,
    iam_id: metadata?.iamId || null,
    display_name: expertNode?.name || expertNode?.contactInfo?.name || null,
    updated_at: new Date()
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
        expert_id: normalizeExpertId(getExpertIdFromRole(role)),
        role_type: pickRoleType(role),
        role_name: role?.name || null,
        is_visible: role?.['is-visible'] === true,
        is_suppressed: role?.['ae-roleof-suppress'] === true
      };
    })
    .filter(Boolean)
    .filter(role => role.grant_id && role.role_type);
}

async function upsertUser(client, schema, row) {
  await client.query(
    `INSERT INTO ${schema}."user"
      (email, expert_id, ucd_person_uuid, iam_id, display_name, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (email)
     DO UPDATE SET
      expert_id = EXCLUDED.expert_id,
      ucd_person_uuid = EXCLUDED.ucd_person_uuid,
      iam_id = EXCLUDED.iam_id,
      display_name = EXCLUDED.display_name,
      updated_at = CURRENT_TIMESTAMP`,
    [row.email, row.expert_id, row.ucd_person_uuid, row.iam_id, row.display_name]
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
  await client.query(`DELETE FROM ${schema}.expert_grant_role WHERE grant_id = $1`, [grantId]);

  for (const role of roles) {
    await client.query(
      `INSERT INTO ${schema}.expert_grant_role
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

function isMivPostgresLoadEnabled() {
  return toBool(process.env.MIV_POSTGRES_LOAD_ENABLED || process.env.MIV_PG_LOAD_ENABLED, false);
}

async function loadMivPostgres({ user, metadata={}, files=[] }) {
  if (!isMivPostgresLoadEnabled()) return;

  const schema = getSchemaName();
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

async function purgeMivPostgresExpert(expertId) {
  if (!isMivPostgresLoadEnabled() || !expertId) return;

  const schema = getSchemaName();
  assertSchemaName(schema);

  const pgClient = new PgClient();
  const normalizedExpertId = normalizeExpertId(expertId);

  if (!normalizedExpertId) return;

  try {
    await pgClient.query('BEGIN');

    await pgClient.query(`DELETE FROM ${schema}.expert_grant_role WHERE expert_id = $1`, [normalizedExpertId]);

    await pgClient.query(
      `DELETE FROM ${schema}."grant" g
       WHERE NOT EXISTS (
         SELECT 1 FROM ${schema}.expert_grant_role gr WHERE gr.grant_id = g.grant_id
       )`
    );

    await pgClient.query(
      `UPDATE ${schema}."user"
       SET expert_id = NULL,
           ucd_person_uuid = NULL,
           iam_id = NULL,
           display_name = NULL,
           updated_at = CURRENT_TIMESTAMP
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

function captureErrors() {
  process.on('uncaughtException', async (err) => {
    await captureError(err);
    await config.postgres.client.end();

    console.error(err);
    process.exit(1);
  });
  process.on('unhandledRejection', async (reason, promise) => {
    await captureError(reason);
    await config.postgres.client.end();

    console.error(reason);
    process.exit(1);
  });
}

async function enableFromCli(command, user, options) {
  let weekYearInfo = getYearWeek({allValues: true, asString: true});

  config.reporting.enabled = true;
  config.reporting.jobId = options.reportingJobId || config.reporting.jobId;
  config.reporting.command = command;
  config.reporting.opts = options;
  config.reporting.yearWeek = weekYearInfo.yearWeek;
  config.reporting.weekStart = weekYearInfo.weekStart;
  config.reporting.userId = user;
  config.postgres.client = new PgClient();
  let commandId = await config.postgres.client.insertCommand({
    job_id: config.reporting.jobId,
    command: config.reporting.command,
    year_week: config.reporting.yearWeek,
    week_start: config.reporting.weekStart,
    user_id: config.reporting.userId,
    options: config.reporting.opts
  });
  config.reporting.commandId = commandId;
  captureErrors();
}

/**
 * @method cleanup
 * @description Clean up old commands and user entries from the reporting database. 
 * Deletes commands older than the specified number of weeks.  If an option is 
 * not specified, it will not be cleaned up.
 * 
 * @param {Object} opts 
 * @param {number} opts.commands - Number of weeks to keep commands. Deletes commands older than this.
 * @param {number} opts.users - Number of weeks to keep user cache entries. Deletes entries older than this.
 * @param {PgClient} opts.pgClient - Optional PgClient instance to use for database operations. If not provided, a new instance will be created.
 * 
 * @returns {Promise<void>}
 */
async function cleanup(opts={}) {
  let pgClient = opts.pgClient || config.postgres.client;
  let closeClient = false;
  
  if( !pgClient ) {
    pgClient = new PgClient();
    await pgClient.connect();
    closeClient = true;
  }

  let result = {};

  if( opts.commands ) {
    console.log('Cleaning up old commands more than', opts.commands, 'weeks old...');
    let resp = await pgClient.query(`SELECT * FROM ${pgClient.schema}.cleanup_old_commands(${opts.commands})`);
    result = Object.assign(result, resp.rows[0]);
  }

  if( opts.users ) {
    console.log('Cleaning up old user cache more than', opts.users, 'weeks old...');
    let resp = await pgClient.query(`SELECT * FROM ${pgClient.schema}.cleanup_old_users(${opts.users})`);
    result = Object.assign(result, resp.rows[0]);
  }

  if( closeClient ) {
    await pgClient.end();
  }

  return result;
}


export {
  cleanup,
  enableFromCli,
  captureErrors,
  updateEsIndex,
  initYearWeek,
  loadMivPostgres,
  purgeMivPostgresExpert,
  isMivPostgresLoadEnabled
}