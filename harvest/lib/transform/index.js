import cache from '../cache.js';
import { logger, config } from '@ucd-lib/experts-commons';
import path from 'path';
import fs from 'fs';

import jsonAtomToJsonLd from './jsonatom-to-jsonld.js';
import iamApiToJsonLd from './iam-to-jsonld.js';
import {runFromFiles as jsonLdToPerson} from './person.js';
import {runFromFiles as personToWebapp} from './elastic-search/index.js';
import {runFromFiles as toRelationshipsJsonLd} from './to-relationships-jsonld.js';
import wrapUserDomain from '../user-domain.js';

async function srcToAeStd(options={}) {
  options.user = wrapUserDomain(options.user);

  logger.info('Transforming data for user:', options.user);
  logger.info('Root directory for transformed data:', cache.getUserPath(options.user, config.cache.aeStdFormatDir));

  logger.info('Clearing existing ae-std transformed data for user:', options.user);
  await cache.deleteUserAsset(options.user, config.cache.aeStdFormatDir, { isDirectory: true });

  // Transform CDL user data
  let cdlJsonLdFiles = [];
  let cdlUserPath = cache.getUserPath(options.user, [config.cache.cdlDir, 'user']);


  var {files} = await cache.readdir(cdlUserPath, true);
  for( let file of files ) {
    if( path.extname(file.filename) === '.json' ) {
      logger.info(`Transform CDL user path: ${file.filepath}`);
      let resp = await jsonAtomToJsonLd(file.filepath);
      cdlJsonLdFiles.push(resp.jsonldFile);
    }
  }

  // Transform CDL rel data
  let cdlRelPath = cache.getUserPath(options.user, [config.cache.cdlDir, 'rel']);

  if( !await cache.exists(cdlRelPath) ) {
    logger.warn(`CDL rel path does not exist: ${cdlRelPath}`);
    return {
      isPublic: false
    };
  }

  let cdlRelJsonLdFiles = [];
  var {files} = await cache.readdir(cdlRelPath, true);
  for( let file of files ) {
    if( path.extname(file.filename) === '.json' ) {
      logger.info(`Transform CDL rel path: ${file.filepath}`);
      let resp = await jsonAtomToJsonLd(file.filepath);
      cdlJsonLdFiles.push(resp.jsonldFile);
      cdlRelJsonLdFiles.push(resp.jsonldFile);
    }
  }

  // Transform IAM directory data
  let iamUserPath = cache.getUserPath(options.user, [config.cache.iamDir, config.cache.iamUserFilename]);
  logger.info(`IAM user path: ${iamUserPath}`);
  let iamDir = await iamApiToJsonLd(iamUserPath);

  let email = iamDir.graph?.['@graph']?.[0]?.email;
  if( !email ) {
    throw new Error(`No email found in IAM profile for user: ${options.user}`);
  }

  // Get expert ID and name from keycloak
  let user = await cache.readUserAsset(options.user, config.cache.keycloakUserFilename);
  user = JSON.parse(user);

  let expertId = user.attributes.expertId[0];
  let expertData = {};
  // Prefer IAM/Directory preferred name when available (keeps behavior consistent with person transform)
  const iamGraph = iamDir && iamDir.graph;
  const iamNode = iamGraph && iamGraph['@graph'] && iamGraph['@graph'][0];
  const iamFirst = iamNode && iamNode.dFirstName;
  const iamPreferredLname = iamNode && iamNode.directory && iamNode.directory.displayName && iamNode.directory.displayName.preferredLname;
  expertData['last-name'] = iamPreferredLname || user.lastName;
  expertData['first-name'] = iamFirst || user.firstName;

  // Transform in std AE Person data
  let result = await jsonLdToPerson(options.user, expertId, iamDir.jsonldFile, cdlJsonLdFiles, config.vocab.ucopFile);

  // Transform in std AE relationships data
  await toRelationshipsJsonLd(cdlRelJsonLdFiles, expertId, expertData, options);
}

async function aeStdToWebapp(options={}) {
  options.user = wrapUserDomain(options.user);

  logger.info('Clearing existing webapp transformed data for user:', options.user);
  await cache.deleteUserAsset(options.user, config.cache.aeWebappDir, { isDirectory: true });

  // Transform in webapp format
  await personToWebapp(options.user);
}

export { srcToAeStd, aeStdToWebapp };
