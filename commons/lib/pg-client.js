import { Client } from 'pg'
import fs from 'fs/promises';
import config from './config.js';

class PgClient {
  constructor(_config, schema=null) {
    this.schema = schema || 'etl_reporting';

    if( !_config ) {
      _config = {
        host: config.postgres.host,
        port: config.postgres.port,
        user: config.postgres.user,
        password: config.postgres.password,
        database: config.postgres.database,
        options: `--search_path=${this.schema},public`
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
}

export default PgClient;