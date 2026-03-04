import jsonpath from 'jsonpath';
import path from 'path';

import cache from '../../cache.js';
import { logger, config } from '@ucd-lib/experts-commons';

import {transformWorks} from './works.js';
import {transformGrants} from './grants.js';

//import {sortJsonArrayByIdAndKeys} from './utils.js';
import { sortJsonRecursively } from '../utils.js';

function extractElementsUserId(rel) {
  // Find the node in @graph with an id matching /users/<digits>/relationships
  let nodes = rel['@graph'] || [];
  if( nodes && !Array.isArray(nodes) ) nodes = [nodes];
  for (const node of nodes) {
    if (typeof node.id === 'string') {
      const match = node.id.match(/\/users\/(\d+)\/relationships/);
      if (match) return match[1];
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

  // Normalise rel['@graph'] to an array so downstream code that does `for (const node of inputGraph)`
  // does not throw "inputGraph is not iterable" when @graph is a single object.
  let inputGraph = rel['@graph'] || [];
  if (inputGraph && !Array.isArray(inputGraph)) inputGraph = [inputGraph];

  works = transformWorks(works, expertId, elementsUserId, inputGraph);
  grants = transformGrants(grants, expertId, expertData);

  await saveRelationshipFiles([...works, ...grants], options);

  return { success: true, works, grants };
}

async function toRelationshipsJsonLd(relationshipFiles, expertId, expertData, options) {
  if (!relationshipFiles || relationshipFiles.length === 0) {
    logger.warn(`No relationship files provided for user: ${options.user}`);
    return;
  }

  let grants = [];
  let works = [];

  logger.info(`Running AE std relationship transformation for user: ${options.user}`);
  for( let file of relationshipFiles ) {
    logger.info(`Processing relationship file: ${file}`);
    let rel = JSON.parse(await cache.read(file));
    let result = await run(rel, expertId, expertData, options);
    grants.push(...result.grants);
    works.push(...result.works);
  }

  return { success: true, message: "Transformation completed", grants, works };
}

async function saveRelationshipFiles(relationships, options) {
  for( let relationship of relationships ) {
    let { relationshipUri, graph } = relationship;
    // graph = sortJsonRecursively(graph);

    await cache.writeUserAsset(
      options.user,
      path.join(config.cache.aeStdFormatDir, 'rel', `${relationshipUri}.jsonld`),
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
  let grants = allRelationships.filter(r => r.type && (r.type.startsWith("user-grant") || r.type.startsWith('grant-user')));

  return { works, grants };
}

export { run, toRelationshipsJsonLd, saveRelationshipFiles };
