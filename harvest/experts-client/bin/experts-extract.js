import { Command } from 'commander';

import CdlClient from '../lib/extract/cdl.js';
import IamClient from '../lib/extract/iam.js';
import ExpertsKcAdminClient from '../lib/extract/keycloak.js';

const program = new Command();


const env = process.env;
const ODR_ARK = 'ark:/87287/d7c08j';
const CDL_ARK = 'ark:/87287/d7mh2m';

program.name('extract')
  .description('extract data for aggie experts from cdl & iam')
  .option('--user <user-id>', 'User id to transform')
  .option('--force', 'Force extraction even if data already exists on disk')
  .option('--root-dir <root-dir>', 'Root directory for extracted data.  Respects env EXPERTS_ROOT_DIR', env.EXPERTS_ROOT_DIR || process.cwd())
  .action(async (options) => {

    console.log('Extracting data for user:', options.user);
    console.log('Root directory for extracted data:', options.rootDir);

    let kcClient = new ExpertsKcAdminClient();
    let user = await kcClient.findByEmail(options.user);


    // const iamClient = new IamClient();
    // await iamClient.profile(options.user, {
    //   force: options.force    
    // });

    // const cdlClient = new CdlClient();
    // await cdlClient.getUser(options.user, {
    //   force: options.force
    // });

    // await cdlClient.getUserRelationships(options.user, {
    //   force: options.force
    // });

  });

program.parse(process.argv);