import { Command } from 'commander';
import CdlClient from '../lib/extract/cdl.js';
import logger from '../lib/logger.js';
import config from '../lib/config.js';

const program = new Command();
const env = process.env;

program
  .command('users')
  .argument('<group-id>')
  .description('list users from CDL group')
  .option('--root-dir <root-dir>', 'Root directory for extracted data. Respects env EXPERTS_ROOT_DIR')
  .option('--enable-gcs-cache', 'Enable Google Cloud Storage caching, respects env EXPERTS_CACHE_GCS_ENABLED')
  .action(async (groupId, options) => {
    if( options.reportingJobId || options.reporting ) {
      await enableFromCli('experts-harvest-list', groupId, options);
    }

    if( options.enableGcsCache ) {
      config.cache.gcs.enabled = true;
    }
    logger.info('Google Cloud Storage caching '+ (config.cache.gcs.enabled ? 'enabled' : 'disabled'));    



    const client = new CdlClient();
    const users = await client.getGroupList(groupId);
    logger.info({
      groupId: users.groupId,
      groupName: users.groupName,
      cachePath: users.cachePath
    })
  });

program
  .command('groups')
  .description('list groups from CDL user')
  .action(async () => {
    logger.info({groups: config.cdl.prod.group_by_name});
  });

program.parse(process.argv);