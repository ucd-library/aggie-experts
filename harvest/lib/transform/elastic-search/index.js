import fs from 'fs-extra';
import path from 'path';
import jsonld from 'jsonld';
import { logger, config } from '@ucd-lib/experts-commons';
import cache from '../../cache.js';
import { getYearWeek } from '@ucd-lib/experts-commons';

import {
  sortJsonRecursively, 
  getGraphAsItems,
  SHORT_TYPES,
  asArray
} from '../utils.js';
import {
  generateExpertFile,
  promoteExpertNodeToRoot,
  normalizeExpertIdsDeep
} from './to-person-webapp.js';
import { generateWorkFiles, updateWorkRelatedByRelates } from './to-work-webapp.js';
import { generateGrantFiles, updateGrantRelatedByRelates } from './to-grant-webapp.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const contextPath = path.join(__dirname, 'schema', '4', 'context.jsonld');
const contextFile = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
const framePath = path.join(__dirname, 'frames', 'default.json');
const frameFile = JSON.parse(fs.readFileSync(framePath, 'utf8'));


/**
 * @method collapseSingleItemPrimitiveArrays
 * @description Collapses arrays that contain a single primitive value
 * (string, number, boolean, null) onto a single line.
 * This is useful for cleaning up JSON output for better readability
 * and diff comparisons.
 * @param {*} jsonText
 * @returns
 */
function collapseSingleItemPrimitiveArrays(jsonText) {
  const primitivePattern = /(\"(?:\\.|[^\"\\])*\"|[-+]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/;
  const re = new RegExp(
    '\\[\\n\\s*' + primitivePattern.source + '\\n\\s*\\]',
    'g'
  );
  return jsonText.replace(re, '[$1]');
}

/**
 * @method annotateWorkValidationFlags
 * @description Ensure work nodes carry invalid-title / invalid-issued flags in experts docs.
 * @param {Array} graph compacted @graph array
 */
function annotateWorkValidationFlags(graph) {
  if (!Array.isArray(graph)) return;

  for (const node of graph) {
    if (!node || !node['@type']) continue;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    const isWork = types.some(t =>
      t.includes('Work') ||
      t.includes('ScholarlyArticle') ||
      t.includes('Article') ||
      t.includes('Publication')
    );
    if (!isWork) continue;

    node['invalid-title'] = Array.isArray(node.title)
      ? node.title.length > 1
      : typeof node.title !== 'string';
    node['invalid-issued'] = typeof node.issued !== 'string';
  }
}

/**
 * @method findRelatedExperts
 * @description Given a publication or grant subject URI, finds all related expert IDs
 * by searching relationship files in the cache that reference the publication.
 * @param {String} subject publication or grant subject URI
 * @param {String} excludeExpertId optional expert ID to exclude from results
 * @returns {Array} objects with `node` and corresponding `filepath` properties
 */
async function findRelatedExperts(subject, excludeExpertId) {
  const partitionKeys = [getYearWeek(), 'ae-std'];
  const relNodes = [];

  if (!cache || !cache.caskFs || !cache.caskFs.rdf || typeof cache.caskFs.rdf.find !== 'function') {
    logger.warn('cask RDF interface not available');
    return [];
  }

  const rdfResp = await cache.caskFs.rdf.find({ subject, partitionKeys });
  logger.debug(`RDF find for ${subject} returned ${rdfResp?.results?.length || 0} results`);

  if (!rdfResp || !Array.isArray(rdfResp.results)) return [];

  // normalize exclude id to short form (no fragment)
  let normExclude = null;
  if (excludeExpertId && typeof excludeExpertId === 'string') {
    normExclude = excludeExpertId.startsWith('http://experts.ucdavis.edu/expert/')
      ? excludeExpertId.replace('http://experts.ucdavis.edu/expert/', '')
      : excludeExpertId.replace(/^expert\//, '');
    normExclude = normExclude.split('#')[0];
  }

  for (const res of rdfResp.results) {
    const fp = res.filepath;
    if (!fp) continue;
    try {
      const txt = await cache.read(fp);
      const rel = JSON.parse(txt);
      const items = Array.isArray(rel)
        ? rel
        : Array.isArray(rel?.['@graph'])
          ? rel['@graph']
          : [rel];

      for (const node of items) {
        if (!node || !node['@id']) continue;
        // Only consider relationship nodes
        if (!(typeof node['@id'] === 'string' && node['@id'].includes('/relationship/'))) continue;

        const relatesAny = node['http://vivoweb.org/ontology/core#relates'] || node['ucdlib:relates-to'] || node['relatesTo'];
        const relatesArr = Array.isArray(relatesAny) ? relatesAny : (relatesAny ? [relatesAny] : []);
        if (!relatesArr.length) continue;

        // must reference the publication subject
        const referencesPub = relatesArr.some(r => {
          const rid = (typeof r === 'string') ? r : (r && r['@id'] ? r['@id'] : null);
          return rid && rid.split('#')[0] === subject;
        });
        if (!referencesPub) continue;

        // filter out excluded expert (if provided)
        const filteredRelates = relatesArr.filter(r => {
          const rid = (typeof r === 'string') ? r : (r && r['@id'] ? r['@id'] : null);
          if (!rid) return true;
          if (!normExclude) return true;
          let short = rid;
          if (short.startsWith('http://experts.ucdavis.edu/expert/')) short = short.replace('http://experts.ucdavis.edu/expert/', '');
          else short = short.replace(/^expert\//, '');
          short = short.split('#')[0];
          return short !== normExclude;
        });

        // ensure there's at least one expert reference after filtering
        const hasExpertRef = filteredRelates.some(r => {
          const rid = (typeof r === 'string') ? r : (r && r['@id'] ? r['@id'] : null);
          return rid && (rid.startsWith('http://experts.ucdavis.edu/expert/') || rid.startsWith('expert/'));
        });
        if (!hasExpertRef) continue;

        // clone node and set vivoweb relates to the collected relates
        const outNode = JSON.parse(JSON.stringify(node));
        outNode['http://vivoweb.org/ontology/core#relates'] = filteredRelates;
        relNodes.push({ node: outNode, filepath: fp });
      }
    } catch (e) {
      logger.error(`Failed to read/parse RDF-found rel file ${fp}`, e);
    }
  }

  return relNodes;
}

/**
 * @method frame
 * @description Frames the data for indexing into elasticsearch.
 *
 * Generates jsonld files using the frame/context files, as well as updating/promoting
 * properties for the expert/works/grants nodes as needed, using logic that used
 * to reside in the fin model code that run during indexing/updates in AEv2.
 * @param {*} expertId
 * @param {*} graph the graph to frame
 * @returns
 */
async function frame(expertId, graph) {
  const item = {
    "@id": "info:fedora" + expertId,
    "@version": 1.1,
    "@graph": graph
  };

  const frameDoc = {
    ...frameFile
  };
  frameDoc["@context"] = contextFile["@context"];

  const framedRaw = await jsonld.frame(
    item,
    frameDoc,
    {
      embed: '@always',
      omitGraph: false,
      explicit: false,
      requireAll: false
    }
  );

  let compacted = await jsonld.compact(framedRaw, contextFile["@context"], {
    embed: '@always'
  }); 

  if (!Array.isArray(compacted["@graph"])) {
    compacted["@graph"] = compacted["@graph"] ? [compacted["@graph"]] : [];
  }

  compacted["@graph"] = normalizeExpertIdsDeep(compacted["@graph"]);
  compacted['@graph'].forEach(normalizeScalars);
  compacted["@graph"].forEach(normalizeBooleans);
  compacted["@graph"] = normalizeUnicodeSpacesDeep(compacted["@graph"]);

  compacted["@graph"].forEach(node => {
    if (node?.author) {
      if (!Array.isArray(node.author)) {
        node.author = [node.author];
      }
      node.author.sort((a, b) => (a?.rank || 0) - (b?.rank || 0));
    }
  });

  compacted["@graph"] = compacted["@graph"].filter((node) => {
    // keep everything that is not a relationship path
    if (!(typeof node['@id'] === 'string' && node['@id'].includes('/relationship/'))) return true;

    // if it's a relationship node, only keep it when it's an Authorship-like node
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    const isAuthorship = types.some(t => (typeof t === 'string') && (t.includes('Authorship') || t.includes('ucdlib:Authorship')));
    return isAuthorship;
  });

  if (compacted["@graph"] && Array.isArray(compacted["@graph"])) {
    const expertNodes = [];
    const workNodes = [];
    const grantNodes = [];
    const otherNodes = [];

    // Normalize expert IDs for comparison
    const normalizeId = (id) => {
      if (!id || typeof id !== 'string') return id;
      if (id.startsWith('http://experts.ucdavis.edu/expert/')) return id.replace('http://experts.ucdavis.edu/expert/', '');
      if (id.startsWith('info:fedora/expert/')) return id.replace('info:fedora/expert/', '');
      if (id.startsWith('expert/')) return id.replace(/^expert\//, '');
      return id;
    };
    const primaryExpertIdNormalized = normalizeId(expertId);

    compacted["@graph"].forEach(node => {
      if (!node || !node['@type']) {
        otherNodes.push(node);
        return;
      }
      const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      const isExpert = types.some(t => t.includes('Expert') || t.includes('Person') || t.includes('Agent'));
      const isWork = types.some(t =>
        t.includes('Work') || t.includes('ScholarlyArticle') || t.includes('Article') || t.includes('Publication')
      );
      const isGrant = types.some(t => t.includes('Grant'));

      if (isExpert) {
        // Only keep the primary expert, filter out related experts
        if (normalizeId(node['@id']) === primaryExpertIdNormalized) {
          expertNodes.push(node);
        }
      } else if (isWork) workNodes.push(node);
      else if (isGrant) grantNodes.push(node);
      else otherNodes.push(node);
    });

    compacted["@graph"] = [...expertNodes, ...workNodes, ...grantNodes, ...otherNodes];
  }

  annotateWorkValidationFlags(compacted["@graph"]);

  // Ensure the document root @id matches canonical expert/<id> form
  const rootIdShort = expertId;
  const canonicalRoot = rootIdShort.startsWith('expert/') ? rootIdShort : `expert/${rootIdShort}`;
  compacted["@id"] = canonicalRoot;
  compacted["@context"] = (config?.server?.url || 'https://stage.experts.library.ucdavis.edu') + "/api/schema/context.jsonld";

  compacted = promoteExpertNodeToRoot(compacted, config);
  updateWorkRelatedByRelates(compacted);
  updateGrantRelatedByRelates(compacted);
  // Flatten any embedded relates objects across all nodes/roles
  function flattenRelates(doc){
    if (!doc || !Array.isArray(doc['@graph'])) return;
    doc['@graph'].forEach(node => {
      if (!node) return;
      if (node.relates !== undefined) {
        let arr = Array.isArray(node.relates) ? node.relates : [node.relates];
        node.relates = [...new Set(arr.map(r => typeof r === 'string' ? r : (r && r['@id'])).filter(Boolean))];
      }
      if (Array.isArray(node.relatedBy)) {
        node.relatedBy.forEach(role => {
          if (!role || role.relates === undefined) return;
          let arr = Array.isArray(role.relates) ? role.relates : [role.relates];
          role.relates = [...new Set(arr.map(r => typeof r === 'string' ? r : (r && r['@id'])).filter(Boolean))];
        });
      } else if (node.relatedBy && node.relatedBy.relates !== undefined) {
        let arr = Array.isArray(node.relatedBy.relates) ? node.relatedBy.relates : [node.relatedBy.relates];
        node.relatedBy.relates = [...new Set(arr.map(r => typeof r === 'string' ? r : (r && r['@id'])).filter(Boolean))];
      }
    });
  }
  flattenRelates(compacted);

  return compacted;
}

/**
 * @method createScholarlyWorksGraph
 * @description Reads all relationship files for a given expert in the `/scholarly-works` directory,
 * identifies the type of relationship, links the roles in relatedBy, and returns the deduped/combined array.
 * 
 * @param {*} cacheUsername
 * @param {*} expertId
 * @returns
 */
async function createScholarlyWorksGraph(cacheUsername, expertId) {
  const relDir = path.join(config.cache.aeStdFormatDir, 'scholarly-works');
  const relCachePath = cache.getUserPath(cacheUsername, relDir);

  logger.info(`Reading relationship files from: ${relCachePath}`);
  let combinedGraph = [];

  try {
    if (!await cache.exists(relCachePath)) {
      logger.warn(`Relationship directory does not exist: ${relCachePath}`);
      return combinedGraph;
    }

    const files = (await cache.readdir(relCachePath, true)).files.filter(f => f.filename.endsWith('.jsonld'));
    logger.info(`Found ${files.length} relationship files`);

    for (const file of files) {
      await _parseExpertsScholarlyWorks(expertId, file);
    }
  } catch (e) {
    logger.error(`Error reading relationship files for ${expertId}: ${e.message}`);
  }

  return combinedGraph;
}

async function _parseExpertsScholarlyWorks(expertId, file) {
  const filePath = file.filepath;
  let relationshipData;
  try {
    relationshipData = JSON.parse(await cache.read(filePath));
  } catch (e) {
    logger.error(`Error parsing ${filePath}: ${e.message}`);
    return;
  }

  let graphItems = getGraphAsItems(relationshipData);

  const tmp = new Map();
  graphItems.forEach(n => {
    if (n && n['@id']) tmp.set(n['@id'], n);
  });
  graphItems = tmp;

  // For this file, find any publication/grant subjects and fetch relationship nodes
  // from other experts that reference the same subject, then append those nodes
  // onto this file's graphItems (avoid duplicates via byId).
  try {
    const subjects = Array.from(new Set(
      graphItems.keys()
        .filter(id => id.includes('/publication/') || id.includes('/grant/'))
        .map(id => id.split('#')[0])
    ));

    for (const subj of subjects) {
      try {
        await _parseExpertsScholarlyWork(subj, expertId, graphItems);
      } catch (e) {
        logger.error(`_parseExpertsScholarlyWork failed for ${subj}: ${e.message}`);
      }
    }
  } catch (e) {
    logger.error(`Error fetching external relationship nodes: ${e.message}`);
  }

  let grantCount = 0;
  let workCount = 0;
  const roles = [];

  graphItems.values().forEach(node => {
    if (!node || !node['@type']) return;
    const types = asArray(node['@type']);
    if (types.some(t => SHORT_TYPES.GRANTS.includes(t))) grantCount++;
    else if (types.some(t => SHORT_TYPES.WORKS.includes(t))) workCount++;
    else if (types.some(t => SHORT_TYPES.ROLES.includes(t))) roles.push(node);
  });

  const getRelatesIds = (role) => {
    const candidates = [
      'http://vivoweb.org/ontology/core#relates',
      'ucdlib:relates-to',
      'relatesTo'
    ];
    for (const p of candidates) {
      if (role[p]) {
        const arr = Array.isArray(role[p]) ? role[p] : [role[p]];
        return arr.filter(x => x && x['@id']).map(x => x['@id']);
      }
    }
    return [];
  };

  roles.forEach(role => {
    const relatedIds = getRelatesIds(role);
    relatedIds.forEach(rid => {
      const target = byId.get(rid);
      if (target) {
        if (!target.relatedBy) target.relatedBy = [];
        else if (!Array.isArray(target.relatedBy)) target.relatedBy = [target.relatedBy];
        if (!target.relatedBy.find(rb => rb['@id'] === role['@id'])) {
          target.relatedBy.push({"@id": role['@id']});
        }
      }
    });
  });

  combinedGraph.push(...graphItems.values());
  const fileLabel = (file && typeof file === 'object') ? (file.filename || file.filepath || JSON.stringify(file)) : file;
  logger.info(`Added ${graphItems.length} nodes from ${fileLabel} (grants=${grantCount}, works=${workCount}, roles=${roles.length})`);
}

async function _parseExpertsScholarlyWork(subject, expertId, graphItems) {
  const relNodes = await findRelatedExperts(subject, expertId);
  if (!Array.isArray(relNodes) || relNodes.length === 0) return;

  for (const rnObj of relNodes) {
    const rn = rnObj.node;
    const relFilePath = rnObj.filepath;
    if (!rn || !rn['@id']) continue;
    if (graphItems.has(rn['@id'])) continue;

    graphItems.set(rn['@id'], rn);
    logger.debug(`Appended external relationship node ${rn['@id']} for subject ${subject} (from RDF)`);

    // --- Add external expert person.jsonld node(s) ---
    // Find all expert URIs referenced in this relationship node
    const relates = rn['http://vivoweb.org/ontology/core#relates'] || [];
    const relatesArr = Array.isArray(relates) ? relates : [relates];

    for (const r of relatesArr) {
      const rid = typeof r === 'string' ? r : (r && r['@id'] ? r['@id'] : null);
      if (!rid) continue;

      // Only fetch if it's an expert URI
      let shortId = null;
      if (rid.startsWith('http://experts.ucdavis.edu/expert/')) {
        shortId = rid.replace('http://experts.ucdavis.edu/expert/', '').split('#')[0];
      } else if (rid.startsWith('expert/')) {
        shortId = rid.replace(/^expert\//, '').split('#')[0];
      }

      if( !shortId ) continue;
      if( graphItems.has(rid) ) continue;

      // Derive the external expert's cache username from the relFilePath
      // relFilePath: /weekly/<year-week>/<external_expert_cache_username>/ae-std/scholary-output/<rel_filename>
      // person.jsonld path: /weekly/<year-week>/<external_expert_cache_username>/ae-std/person.jsonld
      const externalCacheUsername = relFilePath.match(/\/([a-z0-9@\.]+)\/ae-std\//)?.[1];
      if (!externalCacheUsername) continue;

      const personAssetPath = 'ae-std/person.jsonld';
      try {
        const personTxt = await cache.readUserAsset(externalCacheUsername, personAssetPath);
        const personNode = JSON.parse(personTxt);
        // If personNode is an array or has @graph, normalize to array of nodes
        const personNodes = getGraphAsItems(personNode);
        
        for (const pn of personNodes) {
          if (pn && pn['@id'] && !graphItems.has(pn['@id'])) {
            graphItems.set(pn['@id'], pn);
            logger.debug(`Appended person node ${pn['@id']} for external expert ${shortId}`);
          }
        }
      } catch (e) {
        logger.error(`Could not fetch person.jsonld for external expert ${shortId}: ${e.message}`);
      }        
    }
  }
}

async function runFromFiles(cacheUsername) {
  logger.info(`Running AE webapp transformation for user: ${cacheUsername}`);

  // Read the main expert graph
  const expertGraph = JSON.parse(await cache.readUserAsset(cacheUsername, 'ae-std/person.jsonld'));

  // Get expert ID
  let expertId = expertGraph.find(n => n['@type'] && n['@type'].includes('http://schema.library.ucdavis.edu/schema#Expert'));
  expertId = expertId['@id'].replace('http://experts.ucdavis.edu/expert/', '');

  // Read all relationship files (works/grants)
  const {relationshipGraph, workFiles, grantFiles} = await readRelationshipFiles(cacheUsername, expertId);

  let combinedGraph = Array.isArray(expertGraph)
    ? [...expertGraph, ...relationshipGraph]
    : [expertGraph, ...relationshipGraph];

  // Log memory and node counts, then dedupe nodes by @id to avoid huge graphs
  try {
    const mBefore = process.memoryUsage();
    logger.debug(`pre-frame memory rss=${mBefore.rss} heapUsed=${mBefore.heapUsed} heapTotal=${mBefore.heapTotal}`);
    logger.info(`combinedGraph length before dedupe: ${combinedGraph.length}`);

    const uniq = new Map();
    // Dedupe only nodes that have an @id. Nodes without an @id (blank nodes)
    // cannot be reliably deduplicated across runs, so preserve them as-is
    // in their original order.
    const noIdNodes = [];
    for (const n of combinedGraph) {
      if (n && n['@id']) {
        if (!uniq.has(n['@id'])) uniq.set(n['@id'], n);
      } else {
        noIdNodes.push(n);
      }
    }

    logger.info(`unique node count before frame: ${uniq.size} (plus ${noIdNodes.length} nodes without @id preserved)`);
    combinedGraph = [...Array.from(uniq.values()), ...noIdNodes];

    const mAfter = process.memoryUsage();
    logger.debug(`post-dedupe memory rss=${mAfter.rss} heapUsed=${mAfter.heapUsed} heapTotal=${mAfter.heapTotal}`);
  } catch (err) {
    logger.error(`Error during pre-frame dedupe/logging: ${err.message}`, { error: err });
  }

  let framed = await frame(expertId, combinedGraph);
  framed = sortJsonRecursively(framed);

  // generate files
  const expertFile = await generateExpertFile(cacheUsername, framed, { collapseSingleItemPrimitiveArrays });
  // const workFiles = await generateWorkFiles(cacheUsername, expertId, framed, { collapseSingleItemPrimitiveArrays });
  // const grantFiles = await generateGrantFiles(cacheUsername, expertId, framed, { collapseSingleItemPrimitiveArrays });

  // create a simple lookup file of scholarly works for user
  let scholarlyWorksRef = {
    works: workFiles.map(f => path.parse(f).name),
    grants: grantFiles.map(f => path.parse(f).name)
  };
  await cache.writeUserAsset(cacheUsername, 'scholarly-works.json', 
    JSON.stringify(scholarlyWorksRef, null, 2)
  );

  return {
    expertFile,
    workFiles,
    grantFiles
  };
}

export {
  runFromFiles,
  frame,
  // readRelationshipFiles,
  collapseSingleItemPrimitiveArrays
};
