import { Command } from 'commander';
import logger from '../lib/logger.js';
import GcsCache from '../lib/google-cloud-storage.js';
import config from '../lib/config.js';
import { enableFromCli as enableReportingFromCli } from '../lib/reporting/index.js';

const program = new Command();

program
  .command('pull')
  .description('Pull a user from Google Cloud Storage')
  .argument('<user-id>', 'User ID to pull')
  .option('--delete', 'Delete any local files that are not in GCS')
  .option('--set-delete-exception', 'Set a delete exception for the user')
  .option('--reporting', 'Enable reporting for this extraction')
  .option('--reporting-job-id <job-id>', 'Job ID for reporting')
  .action(async (userId, options) => {
    if( !userId.match(/@/) ) {
      userId += '@ucdavis.edu';
    }

    if( options.reportingJobId || options.reporting ) {
      await enableReportingFromCli('experts-harvest-pull-gcs-cache', userId, options);
    }

    logger.info(`Pulling user from GCS: ${userId} to ${config.cache.rootDir}`, {options});
    const gcs = new GcsCache();
    await gcs.downloadDirectory(userId, options);

    // set exception for delete operation
    if (options.setDeleteException) {
      await setDeleteException(userId, 'Pulled user from GCS');
    }

    if( config.reporting.enabled ) {
      config.postgres.client.end();
    }
  });

program
  .command('push')
  .description('Push a user to Google Cloud Storage')
  .argument('<user-id>', 'User ID to push')
  .option('--delete', 'Delete any files in GCS that are not local')
  .option('--reporting', 'Enable reporting for this extraction')
  .option('--reporting-job-id <job-id>', 'Job ID for reporting')
  .action(async (userId, options) => {
    if( !userId.match(/@/) ) {
      userId += '@ucdavis.edu';
    }

    if( options.reportingJobId || options.reporting ) {
      await enableReportingFromCli('experts-harvest-push-gcs-cache', userId, options);
    }

    logger.info(`Pushing user to GCS: ${userId} from ${config.cache.rootDir}`, {options});
    const gcs = new GcsCache();
    await gcs.uploadDirectory(userId, options);

    if( config.reporting.enabled ) {
      config.postgres.client.end();
    }
  });
