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

async function srcToAeStd(options={}) {
  if( options.rootDir ) {
    config.cache.rootDir = options.rootDir;
  }

  if( !options.user.match(/@/) ) {
    options.user += '@ucdavis.edu'; // ensure user has a domain
  }

  logger.info('Transforming data for user:', options.user);
  logger.info('Root directory for transformed data:', cache.getPath(options.user, []));

  // Transform CDL user data
  let cdlUserJsonLdFiles = [];
  let cdlUserPath = cache.getPath(options.user, [config.cache.cdlDir, 'user']);

  if( !await cache.exists(cdlUserPath) ) {
    logger.warn(`CDL user path does not exist: ${cdlUserPath}`);
    return;
  }

  var {files} = await cache.readdir(cdlUserPath, true);
  for( let file of files ) {
    if( path.extname(file.filename) === '.json' ) {
      logger.info(`Transform CDL user path: ${file.filepath}`);
      let resp = await jsonAtomToJsonLd(file.filepath);
      cdlUserJsonLdFiles.push(resp.jsonldFile);
    }
  }

  // Transform CDL rel data
  let cdlRelPath = cache.getPath(options.user, [config.cache.cdlDir, 'rel']);

  if( !await cache.exists(cdlRelPath) ) {
    logger.warn(`CDL rel path does not exist: ${cdlRelPath}`);
    return;
  }

  let cdlRelJsonLdFiles = [];
  var {files} = await cache.readdir(cdlRelPath, true);
  for( let file of files ) {
    if( path.extname(file.filename) === '.json' ) {
      logger.info(`Transform CDL rel path: ${file.filepath}`);
      let resp = await jsonAtomToJsonLd(file.filepath);
      cdlRelJsonLdFiles.push(resp.jsonldFile);
    }
  }

  // Transform IAM directory data
  let iamUserPath = cache.getPath(options.user, [config.cache.iamDir, config.cache.iamUserFilename]);
  logger.info(`IAM user path: ${iamUserPath}`);
  let iamDir = await iamApiToJsonLd(iamUserPath);

  let email = iamDir.graph?.['@graph']?.[0]?.email;
  if( !email ) {
    throw new Error(`No email found in IAM profile for user: ${options.user}`);
  }

  // Get expert ID and name from keycloak
  let user = await cache.readUserAsset(options.user, config.cache.keycloakUserFilename);
  user = JSON.parse(user);
  logger.info(`User from Keycloak: ${JSON.stringify(user)}`);
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
  let result = await jsonLdToPerson(options.user, expertId, iamDir.jsonldFile, cdlUserJsonLdFiles, config.vocab.ucopFile);

  // Mark PRIVATE if IAM or CDL indicate profile privacy so downstream (webapp) can skip
  try {
    let isPrivate = false;
    const iamNameFlag = iamDir.graph?.['@graph']?.[0]?.directory?.displayName?.nameWwwFlag;
    if (iamNameFlag === 'N') {
      logger.info(`User ${options.user} marked private via IAM nameWwwFlag=N`);
      isPrivate = true;
    }

    if (!isPrivate) {
      // Scan the JSON-LD user files
      for (const cdlFilePath of cdlUserJsonLdFiles) {
        try {
          // Use cache.read so CaskFS-backed paths are read correctly
          const cdlRaw = await cache.read(cdlFilePath);
          const cdl = JSON.parse(cdlRaw);
          let graph = cdl['@graph'] || [];
          if (!Array.isArray(graph)) graph = [graph];
          for (const g of graph) {
            const obj = g && g['api:object'];
            if (!obj) continue;
            const isPublic = obj['api:is-public'] || obj['is-public'];
            if (isPublic === 'false' || isPublic === false) {
              logger.info(`User ${options.user} marked private via CDL is-public=false in ${cdlFilePath}`);
              isPrivate = true;
              break;
            }
          }
        } catch (e) {
          // Fail closed: any CDL read/parse error means we conservatively treat the user as private
          logger.warn(`Error reading/parsing CDL file ${cdlFilePath} for user ${options.user}; treating user as PRIVATE: ${e.message}`);
          isPrivate = true;
        }
        if (isPrivate) break;
      }
    }

    if (isPrivate) {
      try {
        await cache.writeUserAsset('privacy-marker', options.user, 'PRIVATE', '');
        // Also write marker to archive root for stable lookup from Dagster
        try {
          await cache.writeUserAsset('privacy-marker', options.user, 'PRIVATE', '', { root: '/archive' });
        } catch (e) {
          logger.debug(`Failed to write PRIVATE marker to archive for user ${options.user}: ${e.message}`);
        }
        logger.info(`Wrote PRIVATE marker for user: ${options.user}`);
      } catch (e) {
        logger.warn(`Failed to write PRIVATE marker for user ${options.user}: ${e.message}`);
      }
    } else {
      // If user is no longer private, remove any existing PRIVATE markers
      try {
        if (await cache.existsUserAsset(options.user, 'PRIVATE')) {
          await cache.deleteUserAsset(options.user, 'PRIVATE');
          logger.info(`Removed PRIVATE marker for user: ${options.user} from active root`);
        } else {
          logger.debug(`No PRIVATE marker present in active root for user ${options.user}`);
        }
      } catch (e) {
        logger.warn(`Error checking/deleting PRIVATE marker from active root for user ${options.user}: ${e.message}`);
      }
      try {
        if (await cache.existsUserAsset(options.user, 'PRIVATE', { root: '/archive' })) {
          await cache.deleteUserAsset(options.user, 'PRIVATE', { root: '/archive' });
          logger.info(`Removed PRIVATE marker for user: ${options.user} from archive root`);
        } else {
          logger.debug(`No PRIVATE marker present in archive root for user ${options.user}`);
        }
      } catch (e) {
        logger.warn(`Error checking/deleting PRIVATE marker from archive root for user ${options.user}: ${e.message}`);
      }
    }
  } catch (e) {
    logger.warn(`Error while determining privacy for user ${options.user}: ${e.message}`);
  }

  // Transform in std AE relationships data
  logger.info(`Deleting existing relationship files for user: ${options.user}`);
  await cache.delete(options.user, `${config.cache.aeStdFormatDir}/${expertId}/rel`);
  await toRelationshipsJsonLd(cdlRelJsonLdFiles, expertId, expertData, options);
}

async function aeStdToWebapp(options={}) {
  if( !options.user.match(/@/) ) {
    options.user += '@ucdavis.edu'; // ensure user has a domain
  }

  logger.info(`Checking privacy flags for user: ${options.user}`);

  // Rely on srcToAeStd as the single source of truth for privacy. If a PRIVATE marker exists in archive or active root, skip webapp.
  try {
    if (await cache.existsUserAsset(options.user, 'PRIVATE', { root: '/archive' }) || await cache.existsUserAsset(options.user, 'PRIVATE')) {
      logger.info(`Skipping ae-webapp transform for user ${options.user}: PRIVATE marker present`);
      return;
    }
  } catch (e) {
    logger.warn(`Error checking PRIVATE marker for user ${options.user}: ${e.message}`);
  }

  // Transform in webapp format for public profiles
  await personToWebapp(options.user);
}

export { srcToAeStd, aeStdToWebapp };
