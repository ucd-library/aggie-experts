import fs from 'fs';
import path from 'path';
import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';
import { loadFiles as loadEs } from './elastic-search/index.js';

async function run(user) {
  
  const webappDir = cache.getPath(user, config.cache.aeWebappDir);
  const files = findJsonldFiles(webappDir);
  await loadEs(user, files);
  logger.info(`Loaded data into elastic search for user: ${user}`);
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