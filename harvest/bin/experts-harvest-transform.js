import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import { srcToAeStd, aeStdToWebapp } from '../lib/transform/index.js';
import config from '../lib/config.js';
import logger from '../lib/logger.js';
import cache from '../lib/cache.js';
import { enableFromCli } from '../lib/reporting/index.js';

const program = new Command();

program
  .command('ae-std')
  .description('transform data from cdl & iam into aggie experts standard format')
  .argument('<user-id>', 'User id to transform')
  .option('--root-dir <root-dir>', 'Root directory for transformed data.  Respects env EXPERTS_ROOT_DIR')
  .option('--reporting', 'Enable reporting for this transformation')
  .option('--reporting-job-id <job-id>', 'Job ID for reporting')
  .option('--std-sort', 'Sort the ae-std output files for debugging')
  .action(async (userId, options) => {

    if (options.reportingJobId || options.reporting) {
      await enableFromCli('experts-harvest-transform-ae-std', userId, options);
    }

    // Enable ae-std sorting only when requested via CLI flag
    if (options.stdSort) {
      config.transform = config.transform || {};
      config.transform.stdSort = true;
      logger.info('ae-std sorting enabled via --std-sort');
    }

    await srcToAeStd({
      user: userId,
      rootDir: options.rootDir
    });

    if( config.reporting.enabled ) {
      config.postgres.client.end();
    }

    await cache.close();

    // TODO: why is this hanging?
    // process.exit();
  });

program
  .command('webapp')
  .description('transform aggie experts standard format to webapp format.  Requires ALL ae-std transforms to have been run first for proper execution.')
  .argument('<user-id>', 'User id to transform')
  .option('--root-dir <root-dir>', 'Root directory for transformed data.  Respects env EXPERTS_ROOT_DIR')
  .option('--reporting', 'Enable reporting for this transformation')
  .option('--reporting-job-id <job-id>', 'Job ID for reporting')
  .option('--std-sort', 'Sort the ae-std output files for debugging')
  .action(async (userId, options) => {

    if (options.reportingJobId || options.reporting) {
      await enableFromCli('experts-harvest-transform-webapp', userId, options);
    }

    // If requested, enable sorting so any processing that re-sorts will do so
    if (options.stdSort) {
      config.transform = config.transform || {};
      config.transform.stdSort = true;
      logger.info('ae-std sorting enabled via --std-sort');
    }

    await aeStdToWebapp({
      user: userId,
      rootDir: options.rootDir
    });

    if( config.reporting.enabled ) {
      config.postgres.client.end();
    }

    await cache.close();

    // TODO: why is this hanging?
    // process.exit();
  });

program.parse(process.argv);
