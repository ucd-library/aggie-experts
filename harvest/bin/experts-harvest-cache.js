import { Command } from 'commander';
import logger from '../lib/logger.js';
import GcsCache from '../lib/google-cloud-storage.js';
import config from '../lib/config.js';

const program = new Command();

program
  .command('pull')
  .description('Pull a user from Google Cloud Storage')
  .argument('<user-id>', 'User ID to pull')
  .option('--delete', 'Delete any local files that are not in GCS')
  .action(async (userId, options) => {
    if( !userId.match(/@/) ) {
      userId += '@ucdavis.edu';
    }

    logger.info(`Pulling user from GCS: ${userId} to ${config.cache.rootDir}`, {options});
    const gcs = new GcsCache();
    await gcs.downloadDirectory(userId, options);
  });

program
  .command('push')
  .description('Push a user to Google Cloud Storage')
  .argument('<user-id>', 'User ID to push')
  .option('--delete', 'Delete any files in GCS that are not local')
  .action(async (userId, options) => {
    if( !userId.match(/@/) ) {
      userId += '@ucdavis.edu';
    }

    logger.info(`Pushing user to GCS: ${userId} from ${config.cache.rootDir}`, {options});
    const gcs = new GcsCache();
    await gcs.uploadDirectory(userId, options);
  });

program.parse(process.argv);