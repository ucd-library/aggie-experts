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

  let IAMLookupOptions = [
    { email : options.user },
    { userId : options.user.replace(/@.*/, '') } // remove domain if present
  ]

  // const iamClient = new IamClient();
  let iamResp;
  for( let opt of IAMLookupOptions ) {
    try {
      iamResp = await iamClient.profile(opt, {
        force: options.force,
        cacheKey : options.user
      });
      if( iamResp.json ) {
        break; // exit loop if we got a valid response
      }
    } catch (err) {}
  }

  if( !iamResp || !iamResp.json ) {
    throw new Error(`No valid IAM profile found for user: ${options.user}`);
  }

  let email = iamResp.json?.responseData?.results?.[0]?.email;
  if( !email ) {
    throw new Error(`No email found in IAM profile for user: ${options.user}`);
  }

  // let kcClient = new ExpertsKcAdminClient();
  let user = await kcClient.findByEmail(email);

  // const cdlClient = new CdlClient();
  let cdlUserResps = await cdlClient.getUser(options.user, {
    force: options.force
  });

  let cdlRelResps = await cdlClient.getUserRelationships(options.user, {
    force: options.force
  });

  return {
    iam : iamResp.writeResp,
    cdl : [...cdlUserResps, ...cdlRelResps]
  }
}

export default {
  run,
  cdlClient,
  iamClient,
  kcClient
};