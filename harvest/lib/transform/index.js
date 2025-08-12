import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';
import path from 'path';
import fs from 'fs';

import jsonAtomToJsonLd from './jsonatom-to-jsonld.js';
import iamApiToJsonLd from './iam-to-jsonld.js';
import {runFromFiles as jsonLdToPerson} from './person.js';
import {runFromFiles as personToWebapp} from './elastic-search/index.js';
import {runFromFiles as toRelationshipsJsonLd} from './to-relationships-jsonld.js';

async function run(options={}) {
  if( options.rootDir ) {
    config.cache.rootDir = options.rootDir;
  }

  if( !options.user.match(/@/) ) {
    options.user += '@ucdavis.edu'; // ensure user has a domain
  }

  logger.info('Transforming data for user:', options.user);
  logger.info('Root directory for transformed data:', cache.rootDir);

  // Transform CDL user data
  let cdlJsonLdFiles = [];
  let cdlUserPath = cache.getPath(options.user, config.cache.cdlDir, 'user');

  if( !fs.existsSync(cdlUserPath) ) {
    logger.warn(`CDL user path does not exist: ${cdlUserPath}`);
    return;
  }

  let files = fs.readdirSync(cdlUserPath);
  for( let file of files ) {
    if( path.extname(file) === '.json' ) {
      logger.info(`Transform CDL user path: ${cdlUserPath}`);
      let resp = await jsonAtomToJsonLd(path.join(cdlUserPath, file));
      cdlJsonLdFiles.push(resp.jsonldFile);
    }
  }

  // Transform CDL rel data
  let cdlRelPath = cache.getPath(options.user, config.cache.cdlDir, 'rel');

  if( !fs.existsSync(cdlRelPath) ) {
    logger.warn(`CDL rel path does not exist: ${cdlRelPath}`);
    return;
  }

  let cdlRelJsonLdFiles = [];
  files = fs.readdirSync(cdlRelPath);
  for( let file of files ) {
    if( path.extname(file) === '.json' ) {
      logger.info(`Transform CDL rel path: ${cdlRelPath}`);
      let resp = await jsonAtomToJsonLd(path.join(cdlRelPath, file));
      cdlJsonLdFiles.push(resp.jsonldFile);
      cdlRelJsonLdFiles.push(resp.jsonldFile);
    }
  }

  // Transform IAM directory data
  let iamUserPath = cache.getPath(options.user, config.cache.iamDir, config.cache.iamUserFilename);
  logger.info(`IAM user path: ${iamUserPath}`);
  let iamDir = await iamApiToJsonLd(iamUserPath);

  let email = iamDir.graph?.['@graph']?.[0]?.email;
  if( !email ) {
    throw new Error(`No email found in IAM profile for user: ${options.user}`);
  }

  // Get expert ID from keycloak
  let user = await cache.readUserAsset(options.user, config.cache.keycloakUserFilename);
  user = JSON.parse(user);
  logger.info(`User from Keycloak: ${JSON.stringify(user)}`);
  let expertId = `expert/${user.attributes.expertId[0]}`;

  // Transform in std AE Person data
  let result = await jsonLdToPerson(options.user, expertId, iamDir.jsonldFile, cdlJsonLdFiles, config.vocab.ucopFile);

  // Transform in webapp format
  await personToWebapp(options.user, 'TODO', result.assetPath);

  // Transform in std AE relationships data
  logger.info(`Deleting existing relationship files for user: ${options.user}`);
  await cache.delete(options.user, `${config.cache.aeStdFormatDir}/${expertId}/rel`);
  await toRelationshipsJsonLd(cdlRelJsonLdFiles, expertId, options);
}

export default run;
