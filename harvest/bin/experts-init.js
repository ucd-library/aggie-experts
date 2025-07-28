import { Command } from 'commander';
import { initSchema, deleteSchema } from '../lib/load/elastic-search/index.js';
import logger from '../lib/logger.js';
import config from '../lib/config.js';
import PgClient from '../lib/pg-client.js';

const program = new Command();
const env = process.env;

program
  .name('init')
  .description('Init various database components for aggie experts')
  .option('--drop-es-schema', 'Drop the ElasticSearch schema before initializing')
  .action(async (opts={}) => {
    if (opts.dropEsSchema) {
      await deleteSchema();
    }

    logger.info('Initializing ElasticSearch schema for aggie experts...');
    await initSchema();
    logger.info('ElasticSearch schema initialized successfully.');


    logger.info('Initializing PostgreSQL schema for aggie experts...');
    const pgClient = new PgClient();
    await pgClient.connect();
    await pgClient.queryFromFile(config.postgres.schemaFile);
    logger.info('PostgreSQL schema initialized successfully.');
    pgClient.end();
  });


program.parse(process.argv);
