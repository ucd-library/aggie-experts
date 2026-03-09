import cache from '../../cache.js';
import { logger, config } from '@ucd-lib/experts-commons';
import wrapUserDomain from '../../user-domain.js';
import path from 'path';

import jsonAtomToJsonLd from './jsonatom-to-jsonld.js';
import iamApiToJsonLd from './iam-to-jsonld.js';
import {jsonLdToPerson} from './person.js';
import {toRelationshipsJsonLd} from './to-relationships-jsonld.js';

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
  let { isPublic, odrPrivacy, cdlPrivacy, privacyAttributes, noPPSAssociations } = await jsonLdToPerson(options.user, expertId, iamDir.jsonldFile, cdlJsonLdFiles, config.vocab.ucopFile);

  // Transform in std AE relationships data
  let grants = [], works = [];
  if( !await cache.exists(cdlRelPath) ) {
    logger.warn(`CDL rel path does not exist: ${cdlRelPath}`);
  } else {
    let relResp = await toRelationshipsJsonLd(cdlRelJsonLdFiles, expertId, expertData, options);
    grants = relResp.grants;
    works = relResp.works;
  }
  
  let metadata = {
    expertId,
    isPublic,
    odrPrivacy,
    cdlPrivacy,
    privacyAttributes,
    grants: grants.map(g => ({ 
      relationshipUri: g.relationshipUri, 
      uri: g.grantUri, 
      privacy: g.privacy 
    })),
    works: works.map(w => ({ 
      relationshipUri: w.relationshipUri, 
      uri: w.workUri, 
      privacy: w.privacy 
    })),
  }

  if( noPPSAssociations === true ) {
    metadata.iamExtractIssues = metadata.iamExtractIssues || {};
    metadata.iamExtractIssues.noPPSAssociations = true;
  }

  await cache.writeUserAsset(
    options.user,
    'metadata.json',
    JSON.stringify(metadata, null, 2)
  );

  if( metadata.isPublic === false ) {
    await cache.writeUserAsset(
      options.user,
      'PRIVATE',
      ''
    );
  } else if( await cache.existsUserAsset(options.user, 'PRIVATE') ) {
    await cache.deleteUserAsset(options.user, 'PRIVATE');
  }
 
  return metadata;
}

export {
  srcToAeStd
}