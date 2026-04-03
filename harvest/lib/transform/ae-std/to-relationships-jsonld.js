import jsonpath from 'jsonpath';
import path from 'path';

import cache from '../../cache.js';
import { logger, config } from '@ucd-lib/experts-commons';

import {transformWorks} from './works.js';
import {transformGrants} from './grants.js';

//import {sortJsonArrayByIdAndKeys} from './utils.js';
import { sortJsonRecursively } from '../utils.js';

function extractElementsUserId(rel) {
  // Elements relationship exports can vary by version/serializer.
  // We want the numeric Elements user id (the one used in links like .../users/<id>)
  // so downstream code can infer authorship rank.

  const nodesRaw = rel?.['@graph'] || [];
  const nodes = Array.isArray(nodesRaw) ? nodesRaw : [nodesRaw];

  const toStringsDeep = (v, seen = new WeakSet()) => {
    if (v === null || v === undefined) return [];

    // Scalars
    if (typeof v === 'string') return [v];
    if (typeof v === 'number') return [String(v)];
    if (typeof v === 'boolean') return [String(v)];

    // Arrays
    if (Array.isArray(v)) return v.flatMap(x => toStringsDeep(x, seen));

    // Objects
    if (typeof v !== 'object') return [];
    if (seen.has(v)) return [];
    seen.add(v);

    const out = [];

    // JSON-LD scalar wrappers like {"@value": "..."}
    if (typeof v['@value'] === 'string' || typeof v['@value'] === 'number') {
      out.push(String(v['@value']));
    }

    // Common id-ish fields
    if (typeof v.id === 'string' || typeof v.id === 'number') out.push(String(v.id));
    if (typeof v['@id'] === 'string') out.push(String(v['@id']));
    if (typeof v.href === 'string') out.push(String(v.href));

    // Common Elements containers
    if (v['api:links']?.['api:link']) out.push(...toStringsDeep(v['api:links']['api:link'], seen));
    if (v['api:related']) out.push(...toStringsDeep(v['api:related'], seen));
    if (v['api:object']) out.push(...toStringsDeep(v['api:object'], seen));

    // Recurse all properties (covers unknown serializer shapes)
    for (const key of Object.keys(v)) {
      out.push(...toStringsDeep(v[key], seen));
    }

    return out;
  };

  // Only scan @graph
  const strings = nodes.flatMap(n => toStringsDeep(n));

  // Prefer explicit ".../users/<id>/relationships" (most unambiguous)
  for (const s of strings) {
    const match = String(s).match(/\/users\/(\d+)\/relationships\b/);
    if (match) return match[1];
  }

  // Fallback: any .../users/<id> URL
  for (const s of strings) {
    const match = String(s).match(/\/users\/(\d+)\b/);
    if (match) return match[1];
  }

  return null;
}

async function run(rel, expertId, expertData, options = {}) {
  let elementsUserId = extractElementsUserId(rel);
  if (elementsUserId === null || elementsUserId === undefined) {
    console.warn(`Extracted Elements user id: ${elementsUserId} from relationship file for expertId: ${expertId}`);
  }
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
  // v5.5 jsonld: relationship objects are nested under api:relationship
  // v6.13 jsonld: @graph entries are the relationship objects themselves
  let allRelationships = jsonpath.query(rel, '$..["api:relationship"]');
  if (!allRelationships || allRelationships.length === 0) {
    allRelationships = rel && rel['@graph'] ? (Array.isArray(rel['@graph']) ? rel['@graph'] : [rel['@graph']]) : [];
  }

  let works = allRelationships.filter(r =>
    r && r.type === "publication-user-authorship" &&
    r['api:related']?.['api:object']?.type !== "other"
  );
  let grants = allRelationships.filter(r => r && r.type && (r.type.startsWith("user-grant") || r.type.startsWith('grant-user')));

  return { works, grants };
}

export { run, toRelationshipsJsonLd, saveRelationshipFiles };
