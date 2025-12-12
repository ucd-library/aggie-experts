import { Command } from 'commander';
import extract from '../lib/extract/index.js';
import logger from '../lib/logger.js';
import config from '../lib/config.js';
import PgClient from '../lib/pg-client.js';
import cache from '../lib/cache.js';
import { enableFromCli } from '../lib/reporting/index.js';

const program = new Command();
const env = process.env;

program.name('extract')
  .description('extract data for aggie experts from cdl & iam')
  .argument('<user-id>', 'User id to extract')
  .option('--root-dir <root-dir>', 'Root directory for extracted data.  Respects env EXPERTS_ROOT_DIR')
  .option('--reporting', 'Enable reporting for this extraction')
  .option('--reporting-job-id <job-id>', 'Job ID for reporting')
  .option('--enable-gcs-cache', 'Enable Google Cloud Storage caching. Respects env EXPERTS_CACHE_GCS_ENABLED=true')
  .action(async (user, options) => {
    if( options.reportingJobId || options.reporting ) {
      await enableFromCli('experts-harvest-extract', user, options);
    }

    // use a connection pool to speed up writes
    config.cache.poolDbConnection = true;

    if( options.enableGcsCache ) {
      config.cache.gcs.enabled = true;
    }
    logger.info('Google Cloud Storage caching '+ (config.cache.gcs.enabled ? 'enabled' : 'disabled'));    

    let resp = await extract.run({
      user: user,
      force: true,
      rootDir: options.rootDir
    });

    logger.info('Extraction complete for user', user, { 
      files : [resp.iam, ...resp.cdl] 
    });

    if( config.reporting.enabled ) {
      config.postgres.client.end();
    }
    await cache.close();
  });

program.parse(process.argv);