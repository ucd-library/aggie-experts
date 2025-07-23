import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';
import path from 'path';
import fs from 'fs';

import jsonAtomToJsonLd from './jsonatom-to-jsonld.js';
import iamApiToJsonLd from './iam-to-jsonld.js';
import {run as jsonLdToPerson} from './person.js';

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

  logger.info('Transforming data for user:', options.user);
  logger.info('Root directory for transformed data:', cache.rootDir);

  let cdlUserPath = cache.getPath(options.user, config.cache.cdlDir, 'user');
  let files = fs.readdirSync(cdlUserPath);
  for( let file of files ) {
    if( path.extname(file) === '.json' ) {
      logger.info(`Transform CDL user path: ${cdlUserPath}`);
      let resp = await jsonAtomToJsonLd(path.join(cdlUserPath, file));
    }
  }

  let cdlRelPath = cache.getPath(options.user, config.cache.cdlDir, 'rel');
  files = fs.readdirSync(cdlRelPath);
  for( let file of files ) {
    if( path.extname(file) === '.json' ) {
      logger.info(`Transform CDL rel path: ${cdlRelPath}`);
      let resp = await jsonAtomToJsonLd(path.join(cdlRelPath, file));
    }
  }

  let iamUserPath = cache.getPath(options.user, config.cache.iamDir, config.cache.iamUserFilename);
  logger.info(`IAM user path: ${iamUserPath}`);
  let resp = await iamApiToJsonLd(iamUserPath);

}

export default run;