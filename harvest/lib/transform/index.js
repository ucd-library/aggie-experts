import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';
import path from 'path';
import fs from 'fs';

import jsonAtomToJsonLd from './jsonatom-to-jsonld.js';
import iamApiToJsonLd from './iam-to-jsonld.js';
import {runFromFiles as jsonLdToPerson} from './person.js';
import {runFromFiles as personToWebapp} from './elastic-search/index.js';

function sortJsonArrayByIdAndKeys(jsonArray) {
  // sort the array by '@id', then by keys for each
  jsonArray.sort((a, b) => {
    if (a['@id'] < b['@id']) return -1;
    if (a['@id'] > b['@id']) return 1;
    return 0;
  });

  return jsonArray.map(obj => {
    const sortedKeys = Object.keys(obj).filter(k => k !== '@id').sort();
    const newObj = { '@id': obj['@id'] };
    for (const key of sortedKeys) {
      newObj[key] = obj[key];
    }
    return newObj;
  });
}


async function run(options={}) {
  if( options.rootDir ) {
    cache.updateRootDir(options.rootDir);
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

  files = fs.readdirSync(cdlRelPath);
  for( let file of files ) {
    if( path.extname(file) === '.json' ) {
      logger.info(`Transform CDL rel path: ${cdlRelPath}`);
      let resp = await jsonAtomToJsonLd(path.join(cdlRelPath, file));
      cdlJsonLdFiles.push(resp.jsonldFile);
    }
  }

  // Transform IAM directory data
  let iamUserPath = cache.getPath(options.user, config.cache.iamDir, config.cache.iamUserFilename);
  logger.info(`IAM user path: ${iamUserPath}`);
  let iamDir = await iamApiToJsonLd(iamUserPath);
  

  // Transform in std AE Person data
  let result = await jsonLdToPerson(options.user, iamDir.jsonldFile, cdlJsonLdFiles, config.vocab.ucopFile);


  // Transform in webapp format
  await personToWebapp(options.user, 'TODO', result.assetPath);
}

export default run;