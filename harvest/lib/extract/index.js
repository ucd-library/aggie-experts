import CdlClient from './cdl.js';
import IamClient from './iam.js';
import ExpertsKcAdminClient from './keycloak.js';
import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';

const cdlClient = new CdlClient();
const iamClient = new IamClient();
const kcClient = new ExpertsKcAdminClient();

const REQUIRED_PROFILE_FIELDS = ['oFirstName', 'oLastName', 'mothraId', 'iamId', 'userID'];

async function run(options={}) {

  if( options.rootDir ) {
    config.cache.rootDir = options.rootDir;
  }

  logger.info('Extracting data for user', options.user);

  if( options.user.indexOf('@') === -1 ) {
    options.user += '@ucdavis.edu'; // ensure user has a domain
  }

  let IAMLookupOptions = [
    { userId : options.user.replace(/@.*/, '') }, // remove domain if present
    { email : options.user } // extract domain from user
  ]

  logger.info('Clearing cache for user', options.user);
  await cache.deleteUserAsset(options.user, config.cache.cdlDir, { isDirectory: true });
  await cache.deleteUserAsset(options.user, config.cache.iamDir, { isDirectory: true }); 

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
    } catch (err) {
      logger.error(`Error fetching IAM profile with options ${JSON.stringify(opt)}:`, err);
    }
  }

  if( !iamResp || !iamResp.json ) {
    let userText = `userId=${IAMLookupOptions[0].userId} or email=${IAMLookupOptions[1].email}`;
    throw new Error(`No valid IAM profile found for user: ${userText}`);
  }

  let profile = iamResp.json?.responseData?.results?.[0];
  if( !profile ) {
    throw new Error(`No IAM profile found for user: ${options.user}`);
  }

  // JM - I got a response was a string "null" for email for some users, which caused the code to try to create a user with email "null".  Adding this check to prevent that.
  if( !profile.email || (typeof profile.email === "string" && !profile.email.match(/@/)) ) {
    // if no email is found but we have all other properties.  lets use the provided email
    if( REQUIRED_PROFILE_FIELDS.every(field => profile[field]) ) {
      logger.warn(`No email found in IAM profile for user: ${options.user}, but all other required fields are present.  Using provided user identifier as email.`);
      profile.email = options.user;
    } else {
      throw new Error(`No email found in IAM profile for user: ${options.user}`);
    }
  }

  if( config.reporting.enabled && config.postgres.client ) {
    await config.postgres.client.iamUserFetched(options.user);
  }

  let kcUser = {
    firstName: profile.oFirstName,
    lastName: profile.oLastName,
    attributes: {
      ucdPersonUUID: profile.mothraId,
      iamId: profile.iamId
    }
  };

  let user = await kcClient.getOrCreateExpert(profile.email, profile.userID, kcUser);
  await cache.writeUserAsset('keycloak-json-extract', options.user, config.cache.keycloakUserFilename, user);

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
