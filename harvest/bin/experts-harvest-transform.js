import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import transform from '../lib/transform/index.js';
import config from '../lib/config.js';
import logger from '../lib/logger.js';
import { enableFromCli } from '../lib/reporting/index.js';

const __filename = fileURLToPath(import.meta.url);

const program = new Command();



program.name('transform')
  .description('transform data from cdl & iam into aggie experts format')
  .argument('<user-id>', 'User id to extract')
  .option('--root-dir <root-dir>', 'Root directory for transformed data.  Respects env EXPERTS_ROOT_DIR')
  .option('--reporting', 'Enable reporting for this transformation')
  .option('--reporting-job-id <job-id>', 'Job ID for reporting')
  .option('--enable-gcs-cache', 'Enable Google Cloud Storage caching, respects env EXPERTS_CACHE_GCS_ENABLED')
  .action(async (userId, options) => {

    if (options.reportingJobId || options.reporting) {
      await enableFromCli('experts-harvest-transform', userId, options);
    }

    if( options.enableGcsCache ) {
      config.cache.gcs.enabled = true;
    }
    logger.info('Google Cloud Storage caching '+ (config.cache.gcs.enabled ? 'enabled' : 'disabled'));    


    await transform({
      user: userId,
      rootDir: options.rootDir
    });

    if( config.reporting.enabled ) {
      config.postgres.client.end();
    }

    // TODO: why is this hanging?
    // process.exit();
  });

program.parse(process.argv);
