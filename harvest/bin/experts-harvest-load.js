import { Command, Option } from 'commander';
import load from '../lib/load/index.js';
import config from '../lib/config.js';
import PgClient from '../lib/pg-client.js';
import { enableFromCli } from '../lib/reporting/index.js';

const program = new Command();
const env = process.env;

program.name('load')
  .description('load data for aggie experts into database(s)')
  .argument('<user-id>', 'User id to extract')
  .option('--reporting', 'Enable reporting for this load')
  .addOption(new Option('--alias <alias>', 'ElasticSearch alias').default('stage').choices(['current', 'stage', 'all']))
  .option('--reporting-job-id <job-id>', 'Job ID for reporting')
  .action(async (userId, options) => {
    if( !userId.match(/@/ ) ) {
      userId += '@ucdavis.edu';
    }

    if( options.reportingJobId || options.reporting ) {
      await enableFromCli('experts-harvest-load', userId, options);
    }

    await load(userId, options.alias);

    if( config.reporting.enabled ) {
      await config.postgres.client.end();
    }
  });

program.parse(process.argv);