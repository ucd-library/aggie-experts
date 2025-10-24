import { Client } from 'pg'
import fs from 'fs/promises';
import config from './config.js';

class PgClient {
  constructor() {
    this.schema = 'etl_reporting';
    this.client = new Client({
      host: config.postgres.host,
      port: config.postgres.port,
      user: config.postgres.user,
      password: config.postgres.password,
      database: config.postgres.database
    });
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
    const { job_id, command, user_id, options } = opts;
    const query = `
      INSERT INTO ${this.schema}.command (job_id, command, user_id, options)
      VALUES ($1, $2, $3, $4)
      RETURNING command_id
    `;
    let resp = await this.query(query, [job_id, command, user_id, JSON.stringify(options)]);
    return resp.rows[0].command_id;
  }

  insertFileCacheOp(opts) {
    const {
      command_id,
      step,
      file_path,
      last_modified,
      file_hash,
      last_file_hash,
      local_cache_write
    } = opts;

    const query = `
          INSERT INTO ${this.schema}.file_cache (command_id, step, file_path, last_modified, file_hash, last_file_hash, local_cache_write)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    return this.query(query, [command_id, step, file_path, last_modified, file_hash, last_file_hash, local_cache_write]);
  }

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
}

export default PgClient;