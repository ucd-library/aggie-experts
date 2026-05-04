import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import PgClient from '../lib/pg-client.js';
import { logger } from '@ucd-lib/experts-commons';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SCHEMA_FILE = path.resolve(__dirname, '../lib/load/miv-postgres/schema.sql');

function getConfig() {
  return {
    host: process.env.MIV_POSTGRES_HOST || process.env.POSTGRES_HOST || 'postgres',
    port: process.env.MIV_POSTGRES_PORT || process.env.POSTGRES_PORT || 5432,
    user: process.env.MIV_POSTGRES_USER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.MIV_POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.MIV_POSTGRES_DB || process.env.POSTGRES_DB || 'postgres'
  };
}

const program = new Command();

program
  .name('miv-init')
  .description('Initialize PostgreSQL schema for MIV API data')
  .option('-f, --schema-file <file>', 'Path to SQL schema file', DEFAULT_SCHEMA_FILE)
  .action(async (opts={}) => {
    const pgClient = new PgClient(getConfig(), process.env.MIV_PG_SCHEMA || process.env.MIV_POSTGRES_SCHEMA || 'miv');

    try {
      logger.info('Initializing MIV PostgreSQL schema...');
      await pgClient.connect();
      await pgClient.queryFromFile(opts.schemaFile);
      logger.info('MIV PostgreSQL schema initialized successfully.');
    } finally {
      await pgClient.end();
    }
  });

program.parse(process.argv);
