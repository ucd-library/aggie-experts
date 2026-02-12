import { Command } from 'commander';
// import { srcToAeStd, aeStdToWebapp } from '../lib/transform/index.js';
import { generateWork } from '../lib/transform/webapp/work.js';
import { generateExpert, generateSimplifiedExpert } from '../lib/transform/webapp/expert.js';
import config from '../lib/config.js';
import logger from '../lib/logger.js';
import cache from '../lib/cache.js';
import { enableFromCli } from '../lib/reporting/index.js';

const program = new Command();

program
  .command('ae-std')
  .description('transform data from cdl & iam into aggie experts standard format')
  .argument('<user-id>', 'User id to transform')
  .option('--reporting', 'Enable reporting for this transformation')
  .option('--reporting-job-id <job-id>', 'Job ID for reporting')
  .option('--std-sort', 'Sort the ae-std output files for debugging')
  .action(async (userId, options) => {

    if( !userId.match(/@/ ) ) {
      userId += '@ucdavis.edu';
    }

    if (options.reportingJobId || options.reporting) {
      await enableFromCli('experts-harvest-transform-ae-std', userId, options);
    }

    // use a connection pool to speed up writes
    config.cache.poolDbConnection = true;

    // Enable ae-std sorting only when requested via CLI flag
    if (options.stdSort) {
      config.transform = config.transform || {};
      config.transform.stdSort = true;
      logger.info('ae-std sorting enabled via --std-sort');
    }

    await srcToAeStd({
      user: userId
    });

    if( config.reporting.enabled ) {
      config.postgres.client.end();
    }

    await cache.close();

    // TODO: why is this hanging?
    process.exit();
  });

program
  .command('webapp')
  .description('transform aggie experts standard format to webapp format.  Requires ALL ae-std transforms to have been run first for proper execution.')
  .argument('<user-id>', 'User id to transform')
  .option('--reporting', 'Enable reporting for this transformation')
  .option('--reporting-job-id <job-id>', 'Job ID for reporting')
  .option('--std-sort', 'Sort the ae-std output files for debugging')
  .action(async (userId, options) => {

    if( !userId.match(/@/ ) ) {
      userId += '@ucdavis.edu';
    }

    if (options.reportingJobId || options.reporting) {
      await enableFromCli('experts-harvest-transform-webapp', userId, options);
    }

    // use a connection pool to speed up writes
    config.cache.poolDbConnection = true;

    // If requested, enable sorting so any processing that re-sorts will do so
    if (options.stdSort) {
      config.transform = config.transform || {};
      config.transform.stdSort = true;
      logger.info('ae-std sorting enabled via --std-sort');
    }

    await aeStdToWebapp({
      user: userId
    });

    if( config.reporting.enabled ) {
      config.postgres.client.end();
    }

    await cache.close();

    // TODO: why is this hanging?
    process.exit();
  });

program
  .command('webapp-work')
  .description('transform single work from aggie experts standard format to webapp format.  Requires ALL ae-std transforms to have been run first for proper execution.')
  .argument('<subject-uri>', 'Subject URI of the work to transform')
  .action(async (subjectUri, options) => {

    // use a connection pool to speed up writes
    config.cache.poolDbConnection = true;

    console.log(JSON.stringify(await generateWork(subjectUri), null, 2));
    await cache.close();

    // TODO: why is this hanging?
    process.exit();
  });

program
  .command('webapp-base-expert')
  .description('transform single expert from aggie experts standard format to webapp format.  Requires ALL ae-std transforms to have been run first for proper execution.')
  .argument('<email>', 'Email of the expert to transform')
  .action(async (email, options) => {

    // use a connection pool to speed up writes
    config.cache.poolDbConnection = true;

    console.log(JSON.stringify(await generateExpert(email), null, 2));
    await cache.close();

    // TODO: why is this hanging?
    process.exit();
  });

program
  .command('webapp-simplified-expert')
  .description('transform single expert from aggie experts standard format to webapp format.  Requires ALL ae-std transforms to have been run first for proper execution.')
  .argument('<email>', 'Email of the expert to transform')
  .action(async (email, options) => {

    // use a connection pool to speed up writes
    config.cache.poolDbConnection = true;


    console.log(JSON.stringify(await generateSimplifiedExpert(email), null, 2));
    await cache.close();

    // TODO: why is this hanging?
    process.exit();
  });

program.parse(process.argv);
