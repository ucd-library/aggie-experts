import { Command } from 'commander';
import { srcToAeStd } from '../lib/transform/ae-std/index.js';
import { generateScholarlyWork, generateBaseScholarlyWork, getScholarlyWorkType } from '../lib/transform/webapp/scholary-work.js';
import { generateExpert, generateBaseExpert, generateSimplifiedExpert } from '../lib/transform/webapp/expert.js';
import { getNodeByType, SHORT_TYPES } from '../lib/transform/utils.js';
import config from '../lib/config.js';
import logger from '../lib/logger.js';
import cache from '../lib/cache.js';
import { enableFromCli } from '../lib/reporting/index.js';
import { write } from 'fs-extra';

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

    if( await cache.existsUserAsset(userId, 'metadata.json') ) {
      let metadata = await cache.readUserAsset(userId, 'metadata.json');
      metadata = JSON.parse(metadata);
      if( metadata.iamExtractIssues?.notFound ) {
        logger.warn(`User ${userId} is marked as not found from IAM extraction, skipping transformation.`);
        
        if( config.reporting.enabled ) {
          config.postgres.client.end();
        }

        await cache.close();
        return;
      }
    }

    let metadata = await srcToAeStd({
      user: userId
    });

    if( options.reporting || options.reportingJobId ) {
      await config.postgres.client.setUserPrivacy(
        userId,
        metadata.isPublic,
        metadata.cdlPrivacy || null,
        metadata.odrPrivacy || null
      );
    }

    if( !metadata?.iamExtractIssues ) {
      let baseExpert = await generateBaseExpert(userId, {write: true});
    
      if( !baseExpert ) {
        logger.warn(`Base expert transformation failed for user ${userId}, skipping simplifed transformations.`);
      } else {
        await generateSimplifiedExpert(userId, {write: true});
      }
    } else {
      logger.warn(`Skipping webapp transformations for user ${userId} due to IAM extraction issues: ${JSON.stringify(metadata.iamExtractIssues)}`);
    }

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

    if( await cache.existsUserAsset(userId, 'metadata.json') ) {
      let metadata = await cache.readUserAsset(userId, 'metadata.json');
      metadata = JSON.parse(metadata);
      if( metadata.iamExtractIssues ) {
        if( metadata.iamExtractIssues.notFound ) {
          logger.warn(`User ${userId} is marked as not found from IAM extraction, skipping transformation.`);
        } else if (metadata.iamExtractIssues.noPPSAssociations) {
          logger.warn(`User ${userId} has no PPS associations from IAM extraction, skipping transformation.`);
        }

        if( config.reporting.enabled ) {
          config.postgres.client.end();
        }

        await cache.close();
        return;
      }
    }

    // use a connection pool to speed up writes
    config.cache.poolDbConnection = true;

    // If requested, enable sorting so any processing that re-sorts will do so
    if (options.stdSort) {
      config.transform = config.transform || {};
      config.transform.stdSort = true;
      logger.info('ae-std sorting enabled via --std-sort');
    }

    let expert = await generateExpert(userId, {write: true});

    let swSubjects = expert['@graph']
      .filter(node => getNodeByType(node, SHORT_TYPES.SCHOLARLY_WORK_TYPES, {match: true}))
      .map(node => {
        return {
          uri: node['@id'],
          type: getScholarlyWorkType(node['@type'])
        };
      });


    for( let subject of swSubjects ) {
      await generateScholarlyWork(subject.uri, {write: true});
    }

    if( config.reporting.enabled ) {
      config.postgres.client.end();
    }

    await cache.close();

    // TODO: why is this hanging?
    process.exit();
  });

program
  .command('webapp-base-scholarly-work')
  .description('transform single scholarly work from aggie experts standard format to webapp format.  Requires ALL ae-std transforms to have been run first for proper execution.')
  .argument('<subject-uri>', 'Subject URI of the scholarly work to transform')
  .action(async (subjectUri, options) => {

    // use a connection pool to speed up writes
    config.cache.poolDbConnection = true;

    console.log(JSON.stringify(await generateBaseScholarlyWork(subjectUri), null, 2));
    await cache.close();

    // TODO: why is this hanging?
    process.exit();
  });

program
  .command('webapp-scholarly-work')
  .description('transform single scholarly work from aggie experts standard format to webapp format.  Requires ALL ae-std transforms to have been run first for proper execution.')
  .argument('<subject-uri>', 'Subject URI of the scholarly work to transform')
  .action(async (subjectUri, options) => {

    // use a connection pool to speed up writes
    config.cache.poolDbConnection = true;

    let result = await generateScholarlyWork(subjectUri);
    console.log(JSON.stringify(result.json, null, 2));
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

    console.log(JSON.stringify(await generateBaseExpert(email), null, 2));
    await cache.close();

    // TODO: why is this hanging?
    process.exit();
  });

program
  .command('webapp-expert')
  .description('transform single expert from aggie experts standard format to webapp format.  Requires ALL ae-std transforms to have been run first for proper execution.')
  .argument('<email>', 'Email of the expert to transform')
  .option('--fresh', 'Force fresh transformation by bypassing any cached framed expert data')
  .action(async (email, options) => {

    // use a connection pool to speed up writes
    config.cache.poolDbConnection = true;

    let expert = await generateExpert(email, {fresh: options.fresh});
    console.log(JSON.stringify(expert, null, 2));
    await cache.close();

    // TODO: why is this hanging?
    process.exit();
  });

program
  .command('webapp-simplified-expert')
  .description('transform single expert from aggie experts standard format to webapp format.  Requires ALL ae-std transforms to have been run first for proper execution.')
  .argument('<email>', 'Email of the expert to transform')
  .option('--fresh', 'Force fresh transformation by bypassing any cached framed expert data')
  .action(async (email, options) => {

    // use a connection pool to speed up writes
    config.cache.poolDbConnection = true;

    let simplified = await generateSimplifiedExpert(email, {fresh: options.fresh});
    console.log(JSON.stringify(simplified, null, 2));
    await cache.close();

    // TODO: why is this hanging?
    process.exit();
  });

program.parse(process.argv);
