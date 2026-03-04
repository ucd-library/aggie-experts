import { Command } from 'commander';
import extract from '../lib/extract/index.js';
import {
  logger,
  config,
  ExpertsKcAdminClient
} from '@ucd-lib/experts-commons';
import cache from '../lib/cache.js';
import { enableFromCli } from '../lib/reporting/index.js';
import IAM from '../lib/extract/iam.js';
import wrapUserDomain from '../lib/user-domain.js';

const program = new Command();
const env = process.env;

program.command('run')
  .description('extract data for aggie experts from cdl & iam')
  .argument('<user-id>', 'User id to extract')
  .option('--root-dir <root-dir>', 'Root directory for extracted data.  Respects env EXPERTS_ROOT_DIR')
  .option('--reporting', 'Enable reporting for this extraction')
  .option('--reporting-job-id <job-id>', 'Job ID for reporting')
  .action(async (user, options) => {
    user = wrapUserDomain(user);

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
      await cache.writeUserAsset(user, 'metadata.json', JSON.stringify(metadata));
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

program.command('view-iam')
  .description('View the raw IAM profile for a user')
  .argument('<user-id>', 'User id to extract')
  .action(async (user, options) => {
    const iamClient = new IAM();
    await iamClient.getKey();
    const profile = await iamClient.profile(user);
    console.log(JSON.stringify(profile.json, null, 2));
  });

program.parse(process.argv);