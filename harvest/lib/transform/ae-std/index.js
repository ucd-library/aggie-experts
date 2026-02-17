import cache from '../../cache.js';
import logger from '../../logger.js';
import config from '../../config.js';
import path from 'path';

import jsonAtomToJsonLd from './jsonatom-to-jsonld.js';
import iamApiToJsonLd from './iam-to-jsonld.js';
import {runFromFiles as jsonLdToPerson} from './person.js';
import {runFromFiles as toRelationshipsJsonLd} from './to-relationships-jsonld.js';

async function srcToAeStd(options={}) {
  if( options.rootDir ) {
    config.cache.rootDir = options.rootDir;
  }

  if( !options.user.match(/@/) ) {
    options.user += '@ucdavis.edu'; // ensure user has a domain
  }

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
    return;
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
  let { isVisible, odrIsVisible, cdlIsPublic, cdlPrivacyLevel, privacyAttributes } = await jsonLdToPerson(options.user, expertId, iamDir.jsonldFile, cdlJsonLdFiles, config.vocab.ucopFile);

  // Transform in std AE relationships data
  let { grants, works } = await toRelationshipsJsonLd(cdlRelJsonLdFiles, expertId, expertData, options);
  
  let metadata = {
    expertId,
    isVisible,
    odrIsVisible,
    cdlIsPublic,
    cdlPrivacyLevel,
    privacyAttributes,
    grants: grants.map(g => ({ 
      relationshipUri: g.relationshipUri, 
      grantUri: g.grantUri, 
      isVisible: g.isVisible 
    })),
    works: works.map(w => ({ 
      relationshipUri: w.relationshipUri, 
      workUri: w.workUri, 
      isVisible: w.isVisible 
    })),
  }

  await cache.writeUserAsset(
    'ae-std-relationship-transform',
    options.user,
    'metadata.json',
    JSON.stringify(metadata, null, 2)
  );
  
}

export {
  srcToAeStd
}