import { config, PgClient } from '@ucd-lib/experts-commons';

class PgHarvestClient extends PgClient {
  
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

  ensureUserExpertId(email, expertId) {
    const query = `
      UPDATE ${this.schema}.user
      SET expert_id = $2
      WHERE email = $1
    `;
    return this.query(query, [email, expertId]);
  }

  insertCdlUser(email) {
    const query = `
      INSERT INTO ${this.schema}.user (email)
      VALUES ($1)
      ON CONFLICT (email) DO UPDATE SET last_seen_cdl = CURRENT_TIMESTAMP
    `;
    return this.query(query, [email]);
  }

  iamUserFetched(email) {
    const query = `
      UPDATE ${this.schema}.user
      SET last_seen_iam = CURRENT_TIMESTAMP
      WHERE email = $1
    `;
    return this.query(query, [email]);
  }

  setUserPrivacy(email, isPublic, cdlPrivacy, odrPrivacy) {
    const query = `
      UPDATE ${this.schema}.user
      SET is_public = $2, cdl_privacy = $3, odr_privacy = $4
      WHERE email = $1
    `;
    return this.query(query, [email, isPublic, JSON.stringify(cdlPrivacy), JSON.stringify(odrPrivacy)]);
  }

  setEsStageInsertedAt(email, timestamp) {
    if( timestamp === undefined ) {
      timestamp = new Date();
    }
    const query = `
      UPDATE ${this.schema}.user
      SET es_stage_inserted_at = $2
      WHERE email = $1
    `;
    return this.query(query, [email, timestamp]);
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

export default PgHarvestClient;