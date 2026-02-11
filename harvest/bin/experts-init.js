import { Command } from 'commander';
import { ensureCurrentIndexes, loadSearchTemplate, initPipeline } from '../lib/load/elastic-search/index.js';
import logger from '../lib/logger.js';
import config from '../lib/config.js';
import PgClient from '../lib/pg-client.js';
import cache from '../lib/cache.js';
import {init as dgInit} from '../lib/dagster/init.js';
import { initYearWeek } from '../lib/reporting/index.js';

const program = new Command();

program
  .name('init')
  .description('Init various database components for aggie experts')
  .action(async (opts={}) => {
    let errors = [];

    try {
      logger.info('Ensuring current ElasticSearch indexes for aggie experts...');
      let indexes = await ensureCurrentIndexes();
      logger.info('ElasticSearch indexes ensured successfully.', indexes);
    } catch (error) {
      errors.push(`Error initializing ElasticSearch indexes: ${error.message}`);
    }

    try {
      logger.info('Loading ElasticSearch search templates for aggie experts...');
      await loadSearchTemplate();
      logger.info('ElasticSearch search templates loaded successfully.');
    } catch (error) {
      errors.push(`Error loading ElasticSearch search templates: ${error.message}`);
    }

    try {
      logger.info('Initializing Dagster pipeline for aggie experts...');
      await initPipeline();
      logger.info('Dagster pipeline initialized successfully.');
    } catch (error) {
      errors.push(`Error initializing Dagster pipeline: ${error.message}`);
    }

    const pgClient = new PgClient();
    try {
      logger.info('Initializing PostgreSQL schema for aggie experts...');
      await pgClient.connect();
      await pgClient.queryFromFile(config.postgres.schemaFile);
      await initYearWeek(pgClient);
      logger.info('PostgreSQL schema initialized successfully.');
    } catch (error) {
      throw error;
      // errors.push(`Error initializing PostgreSQL schema: ${error.message}`);
    } finally {
      await pgClient.end();
    }

    try {
      await dgInit();
    } catch (error) {
      errors.push(`Error initializing Dagster database schema: ${error.message}`);
    }

    try {
      logger.info('Initializing caskfs cache...');
      await cache.init();
      logger.info('Caskfs cache initialized successfully.');
    } catch (error) {
      errors.push(`Error initializing caskfs cache: ${error.message}`);
    } finally {
      await cache.close();
    }

    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    } else {
      logger.info('All database components initialized successfully.');
    }
  });


program.parse(process.argv);
