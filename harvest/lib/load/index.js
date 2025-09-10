import fs from 'fs';
import path from 'path';
import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';
import { loadFiles as loadEs } from './elastic-search/index.js';

async function run(user, alias='stage') {
  if( alias === 'all' ) {
    alias = [config.elasticsearch.aliases.stage, config.elasticsearch.aliases.current];
  } else {
    alias = [alias]
  }

  const webappDir = cache.getPath(user, config.cache.aeWebappDir);
  const files = findJsonldFiles(webappDir);

  let indexes = await loadEs(files, alias);

  logger.info(`Loaded data into elastic search for user: ${user}`);

  return indexes;
}

function findJsonldFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findJsonldFiles(filePath));
    } else if (file.endsWith('.jsonld')) {
      results.push(filePath);
    }
  }

  return results;
}

export default run;