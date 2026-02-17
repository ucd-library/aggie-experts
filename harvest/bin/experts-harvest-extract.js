import { Command } from 'commander';
import extract from '../lib/extract/index.js';
import logger from '../lib/logger.js';
import config from '../lib/config.js';
import PgClient from '../lib/pg-client.js';
import ExpertsKcAdminClient from '../lib/extract/keycloak.js';
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
  .action(async (user, options) => {
    if( !user.match(/@/ ) ) {
      user += '@ucdavis.edu';
    }

    if( options.reportingJobId || options.reporting ) {
      await enableFromCli('experts-harvest-extract', user, options);
    }

    // use a connection pool to speed up writes
    config.cache.poolDbConnection = true;

    let resp = await extract.run({
      user: user,
      force: true,
      rootDir: options.rootDir
    });

    if( resp.notFound ) {
      // attempt to get their keycloak profile for their expert id.
      const kcClient = new ExpertsKcAdminClient();
      let expertId = null;
      try {
        await kcClient.authenticate();
        const users = await kcClient.kcadmin.users.find({
          email: user,
          exact: true
        });
        if( users.length > 0 ) {
          const user = users[0];
          expertId = user.attributes?.expertId?.[0];
        }
      } catch(e) {
        logger.error(`Error fetching Keycloak profile for user ${user}:`, e);
      }

      let metadata = {
        expertId,
        isPublic: false,
        iamExtractIssues : {
          notFound: true
        }
      };
      await cache.writeUserAsset('iam-extract', user, 'metadata.json', JSON.stringify(metadata));
      if( options.reporting || options.reportingJobId ) {
        await config.postgres.client.setUserPrivacy(user, false);
      }
    } else {
      logger.info('Extraction complete for user', user, { 
        filesCount : [resp.iam, ...resp.cdl].length
      });
    }
    
    if( config.reporting.enabled ) {
      config.postgres.client.end();
    }
    await cache.close();

    process.exit();
  });

program.parse(process.argv);