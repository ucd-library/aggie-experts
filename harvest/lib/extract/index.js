import CdlClient from './cdl.js';
import IamClient from './iam.js';
import ExpertsKcAdminClient from './keycloak.js';
import cache from '../cache.js';
import logger from '../logger.js';

const cdlClient = new CdlClient();
const iamClient = new IamClient();
const kcClient = new ExpertsKcAdminClient();

async function run(options={}) {

  if( options.rootDir ) {
    cache.updateRootDir(options.rootDir);
  }

  logger.info('Extracting data for user:', options.user);
  logger.info('Root directory for extracted data:', cache.rootDir);

  // let kcClient = new ExpertsKcAdminClient();
  let user = await kcClient.findByEmail(options.user);


  // const iamClient = new IamClient();
  await iamClient.profile(options.user, {
    force: options.force
  });

  // const cdlClient = new CdlClient();
  await cdlClient.getUser(options.user, {
    force: options.force
  });

  await cdlClient.getUserRelationships(options.user, {
    force: options.force
  });

}

export default {
  run,
  cdlClient,
  iamClient,
  kcClient
};