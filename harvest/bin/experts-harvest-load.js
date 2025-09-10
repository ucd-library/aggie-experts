import { Command, Option } from 'commander';
import load from '../lib/load/index.js';
import config from '../lib/config.js';
import logger from '../lib/logger.js';
import { enableFromCli, updateEsIndex } from '../lib/reporting/index.js';
import { getIndexDocumentCount } from '../lib/load/elastic-search/index.js';

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

    let indexes = await load(userId, options.alias);
    logger.info('updated indexes', {indexes});

    if( config.reporting.enabled ) {
      for( let alias in indexes ) {
        let index = indexes[alias];
        let count = await getIndexDocumentCount(index);
        console.log({
          alias, index, count
        })
        await updateEsIndex(alias, index, count);
      }

      await config.postgres.client.end();
    }
  });

program.parse(process.argv);