import { Client } from 'pg'
import fs from 'fs/promises';
import { config } from '@ucd-lib/experts-commons';

class PgClient {
  constructor(_config, schema=null, apiSchema=null) {
    // schema    : ETL observability tables (command, error, year_week,
    //             validation_issue, elastic_search_index, AND etl_reporting."user"
    //             which holds per-moniker ETL timestamps; composite PK expert_id+email).
    // apiSchema : API-shaped projection tables, notably api."user" (identity +
    //             profile fields consumed by the webapp endpoints; PK expert_id),
    //             grant, work.
    //
    // upsertUser() keeps both user tables in sync: etl_reporting.user gets one
    // row per (expert_id, email) moniker; api.user gets one row per person with
    // the email updated to the current active moniker.
    this.schema = schema || 'etl_reporting';
    this.apiSchema = apiSchema || 'api';

    if( !_config ) {
      _config = {
        host: config.postgres.host,
        port: config.postgres.port,
        user: config.postgres.user,
        password: config.postgres.password,
        database: config.postgres.database
      };
    }

    this.client = new Client(_config);
  }

  async connect() {
    if (this.connected) {
      return; // Already connected
    }
    if( this.connecting ) {
      return this.connecting; // Already connecting
    }

    this.connecting = this.client.connect();

    this.client.on('error', (err) => {
      throw new Error(`Postgres client error: ${err.message}`);
    });

    await this.connecting;
    this.connecting = null;
    this.connected = true;
  }

  async queryFromFile(filePath) {
    await this.connect();
    const queryText = await fs.readFile(filePath, 'utf8');
    return this.client.query(queryText);
  }

  async query(text, params) {
    await this.connect();
    return this.client.query(text, params);
  }

  async end() {
    await this.client.end();
  }

  async updateEsIndex(alias, indexName, docCount) {
    let resp = await this.query(
      `UPDATE ${this.schema}.elastic_search_index
      SET index_name = $2, doc_count = $3, last_updated = CURRENT_TIMESTAMP
      WHERE alias_name = $1`,
      [alias, indexName, docCount]
    );
    return resp;
  }

  async insertCommand(opts) {
    const { job_id, year_week, week_start, command, user_id, options } = opts;
    const query = `
      SELECT insert_command as command_id FROM ${this.schema}.insert_command($1, $2, $3, $4, $5, $6)
    `;
    let resp = await this.query(query, [year_week, week_start, job_id, command, user_id, JSON.stringify(options)]);
    return resp.rows[0].command_id;
  }

  // insertFileCacheOp(opts) {
  //   const {
  //     command_id,
  //     step,
  //     file_path,
  //     last_modified,
  //     file_hash,
  //     last_file_hash,
  //     local_cache_write
  //   } = opts;

  //   const query = `
  //         INSERT INTO ${this.schema}.file_cache (command_id, step, file_path, last_modified, file_hash, last_file_hash, local_cache_write)
  //     VALUES ($1, $2, $3, $4, $5, $6, $7)
  //   `;
  //   return this.query(query, [command_id, step, file_path, last_modified, file_hash, last_file_hash, local_cache_write]);
  // }

  insertError(opts) {
    const { command_id, message, stack } = opts;
    const query = `
      INSERT INTO ${this.schema}.error (command_id, message, stack)
      VALUES ($1, $2, $3)
    `;
    return this.query(query, [command_id, message, stack]);
  }

  insertUserScholarlyOutputLoadStats(opts) {
    const { command_id, user_id, type, visibility, count } = opts;
    const query = `
      INSERT INTO ${this.schema}.user_scholarly_output_load_stats (command_id, user_id, type, visibility, count)
      VALUES ($1, $2, $3, $4, $5)
    `;
    return this.query(query, [command_id, user_id, type, visibility, count]);
  }

  insertValidationIssue(opts) {
    const {
      command_id,
      user_id,
      entity_type,
      entity_id,
      issue_type,
      field,
      message
    } = opts;

    const query = `
      INSERT INTO ${this.schema}.validation_issue
        (command_id, user_id, entity_type, entity_id, issue_type, field, message)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7)
    `;

    return this.query(query, [
      command_id,
      user_id,
      entity_type,
      entity_id,
      issue_type,
      field || null,
      message || null
    ]);
  }

  setWebappHost() {
    const query = `
      INSERT INTO ${this.schema}.config (key, value)
      VALUES ('webapp_host', $1)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    return this.query(query, [config.url]);
  }

  // ----- api.user + etl_reporting.user combined upsert -----

  async upsertUser(expertId, email) {
    // etl_reporting.user: composite PK (expert_id, email) — one row per moniker
    await this.query(
      `INSERT INTO ${this.schema}."user" (expert_id, email)
       VALUES ($1, $2)
       ON CONFLICT (expert_id, email) DO UPDATE SET last_seen_cdl = CURRENT_TIMESTAMP`,
      [expertId, email]
    );
    // api.user: expert_id PK — one row per person; update email if moniker changed
    await this.query(
      `INSERT INTO ${this.apiSchema}."user" (expert_id, email)
       VALUES ($1, $2)
       ON CONFLICT (expert_id) DO UPDATE SET email = EXCLUDED.email`,
      [expertId, email]
    );
  }

  // ----- api.user methods (identity / profile / privacy) -----

  setUserPrivacy(email, isPublic, cdlPrivacy, odrPrivacy) {
    const query = `
      UPDATE ${this.apiSchema}."user"
      SET is_public = $2, cdl_privacy = $3, odr_privacy = $4
      WHERE email = $1
    `;
    return this.query(query, [email, isPublic, JSON.stringify(cdlPrivacy), JSON.stringify(odrPrivacy)]);
  }

  // ----- etl_reporting.user methods (ETL observability timestamps) -----

  iamUserFetched(email) {
    const query = `
      UPDATE ${this.schema}."user"
      SET last_seen_iam = CURRENT_TIMESTAMP
      WHERE email = $1
    `;
    return this.query(query, [email]);
  }

  setEsStageInsertedAt(email, timestamp) {
    if( timestamp === undefined ) {
      timestamp = new Date();
    }
    const query = `
      UPDATE ${this.schema}."user"
      SET es_stage_inserted_at = $2
      WHERE email = $1
    `;
    return this.query(query, [email, timestamp]);
  }

  getUsersLapsedFromCdl() {
    // Returns users whose last_seen_cdl fell in last week — they just dropped off CDL.
    // Used by the post-ETL IAM check to see if these users are still in IAM.
    const query = `
      WITH last_year_week AS (
        SELECT year_week FROM ${this.schema}.get_year_week((NOW() - INTERVAL '7 days')::DATE)
      )
      SELECT email, last_seen_cdl, last_seen_iam
      FROM ${this.schema}."user"
      WHERE (SELECT year_week FROM last_year_week)
        = (SELECT year_week FROM ${this.schema}.get_year_week(last_seen_cdl::DATE))
    `;
    return this.query(query);
  }

  insertYearWeek(yearWeek, weekStart, weekEnd) {
    const query = `
      INSERT INTO ${this.schema}.year_week (year_week, week_start, week_end)
      VALUES ($1, $2, $3)
      ON CONFLICT (year_week) DO NOTHING
    `;
    return this.query(query, [yearWeek, weekStart, weekEnd]); 
  }

}

export default PgClient;