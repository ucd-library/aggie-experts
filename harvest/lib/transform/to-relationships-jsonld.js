import jsonpath from 'jsonpath';
import fs from 'fs';
import path from 'path';

import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';

import {transformWorks} from './works.js';
import {transformGrants} from './grants.js';

import {sortJsonArrayByIdAndKeys} from './utils.js';

function extractElementsUserId(rel) {
  // Try from feed.id
  const feedId = rel?.feed?.id;
  if (feedId) {
    const match = feedId.match(/\/users\/(\d+)\/relationships/);
    if (match) return match[1];
  }
  // Fallback: search for first author with elements/user link
  const relationships = jsonpath.query(rel, '$..["api:relationship"]');
  for (const r of relationships) {
    const authors = jsonpath.query(r, '$..["api:person"]');
    for (const author of Array.isArray(authors) ? authors : [authors]) {
      const link = author?.['api:links']?.['api:link'];
      if (link && link.type === 'elements/user' && link.id) {
        return link.id;
      }
    }
  }
  return null;
}

async function run(rel, expertId, expertData, options = {}) {
  let elementsUserId = extractElementsUserId(rel);
  let {
    works,
    grants
  } = parseRelationshipTypes(rel);

  works = transformWorks(works, expertId, elementsUserId);
  grants = transformGrants(grants, expertId, expertData);

  await saveRelationshipFiles([...works, ...grants], expertId, options);

  return { success: true, works: works.length, grants: grants.length };
}

async function runFromFiles(relationshipFiles, expertId, expertData, options) {
  if (!relationshipFiles || relationshipFiles.length === 0) {
    logger.warn(`No relationship files provided for user: ${options.user}`);
    return;
  }

  logger.info(`Running AE std relationship transformation for user: ${options.user}`);
  for( let file of relationshipFiles ) {
    logger.info(`Processing relationship file: ${file}`);
    let rel = JSON.parse(fs.readFileSync(file, 'utf8'));
    await run(rel, expertId, expertData, options);
  }

  return { success: true, message: "Transformation completed" };
}

async function saveRelationshipFiles(relationships, expertId, options) {
  for( let relationship of relationships ) {
    let { relationshipId, graph } = relationship;
    graph = sortJsonArrayByIdAndKeys(graph);

    await cache.writeUserAsset(
      'ae-std-relationship-transform',
      options.user,
      path.join(config.cache.aeStdFormatDir + `/${expertId}/rel/`, `${relationshipId}.jsonld`),
      graph
    );
  }
}


function parseRelationshipTypes(rel) {
  let allRelationships = jsonpath.query(rel, '$..["api:relationship"]');

  let works = allRelationships.filter(r =>
    r.type === "publication-user-authorship" &&
    r['api:related']?.['api:object']?.type !== "other"
  );
  let grants = allRelationships.filter(r => r.type && r.type.startsWith("user-grant"));

  return { works, grants };
}

export { run, runFromFiles, saveRelationshipFiles };
