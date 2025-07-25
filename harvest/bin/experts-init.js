import { Command } from 'commander';
import { initSchema, deleteSchema } from '../lib/load/elastic-search/index.js';
import logger from '../lib/logger.js';

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
  });


program.parse(process.argv);
