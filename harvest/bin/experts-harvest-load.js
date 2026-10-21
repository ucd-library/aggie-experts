import { Command, Option } from 'commander';
import {
  logger,
  config
} from '@ucd-lib/experts-commons';
import load from '../lib/load/index.js';
import cache from '../lib/cache.js';
import { enableFromCli } from '../lib/reporting/index.js';
import wrapUserDomain from '../lib/user-domain.js';

const program = new Command();
const env = process.env;

program.name('load')
  .description('load data for aggie experts into database(s)')
  .argument('<user-id>', 'User id to extract')
  .option('--reporting', 'Enable reporting for this load')
  .addOption(new Option('--alias <alias>', 'ElasticSearch alias')
    .default(config.elasticsearch.aliases.stage)
    .choices([config.elasticsearch.aliases.current, config.elasticsearch.aliases.stage, 'all']))
  .option('--reporting-job-id <job-id>', 'Job ID for reporting')
  .option('--rosetta', 'Load the rosetta-prefixed ae-std/webapp files instead of the legacy ones (defaults from EXPERTS_ROSETTA_ENABLED env var)', config.rosetta.enabled)
  .option('--no-rosetta', 'Force-disable the rosetta pipeline for this run')
  .action(async (userId, options) => {
    userId = wrapUserDomain(userId);

    if( options.reportingJobId || options.reporting ) {
      await enableFromCli('experts-harvest-load', userId, options);
    }

    let indexes = await load(userId, options.alias, {rosetta: options.rosetta});
    logger.info('updated indexes', {indexes});

    if( config.reporting.enabled ) {
      // for( let alias in indexes ) {
      //   let index = indexes[alias];
      //   let count = await getIndexDocumentCount(index);
      //   await updateEsIndex(alias, index, count);
      // }
       await config.postgres.client.end();
    }

    await cache.close();

    process.exit();
  });

program.parse(process.argv);