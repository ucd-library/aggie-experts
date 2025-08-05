import { Command } from 'commander';
import logger from '../lib/logger.js';
import config from '../lib/config.js';
import path from 'path';
import fs from 'fs-extra';

const program = new Command();

program
  .command('set')
  .description('Set a configuration value')
  .option('--service-account-file <file>', 'Path to the service account file for Google Cloud Storage')
  .option('--enable-secret-cache', 'Enable Google Cloud Storage caching, respects env EXPERTS_CACHE_GCS_ENABLED')
  .action((options) => {
    if ( options.serviceAccountFile ) {
      options.serviceAccountFile = path.resolve(options.serviceAccountFile);

      if (!fs.existsSync(options.serviceAccountFile)) {
        logger.error(`Service account file does not exist: ${options.serviceAccountFile}`);
        process.exit(1);
      }

      config.userConfig.set('serviceAccountFile', options.serviceAccountFile);
      logger.info(`Service account file set to: ${options.serviceAccountFile}`);
    }
    if ( options.enableSecretCache ) {
      config.userConfig.set('useSecretCache', true);
      logger.info('Google Cloud Storage caching enabled');
    }
  });

program
  .command('delete')
  .description('Delete a configuration value')
  .option('--service-account-file', 'Delete the service account file configuration')
  .option('--disable-secret-cache', 'Disable Google Cloud Storage caching')
  .action((options) => {
    if ( options.serviceAccountFile ) {
      config.userConfig.set('serviceAccountFile', null);
      logger.info('Service account file configuration deleted.');
    }
    if ( options.disableSecretCache ) {
      config.userConfig.set('useSecretCache', false);
      logger.info('Google Cloud Storage caching disabled');
    }
  });

program
  .command('list')
  .description('List current configuration values')
  .action(() => {
    logger.info('Current configuration:');
    logger.info(JSON.stringify(config.userConfig.data, null, 2));
  });

program.parse(process.argv);