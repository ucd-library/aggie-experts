import fs from 'fs-extra';
import path from 'path';
import jsonld from 'jsonld';
import logger from '../../logger.js';
import config from '../../config.js';
import cache from '../../cache.js';

import {sortJsonRecursively} from '../utils.js';
import {
  generateExpertFile,
  promoteExpertNodeToRoot,
  normalizeExpertIdsDeep
} from './to-person-webapp.js';
import { generateWorkFiles } from './to-work-webapp.js';
import { generateGrantFiles, updateGrantRelatedByRelates } from './to-grant-webapp.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const contextPath = path.join(__dirname, 'schema', '4', 'context.jsonld');
const contextFile = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
const framePath = path.join(__dirname, 'frames', 'default.json');
const frameFile = JSON.parse(fs.readFileSync(framePath, 'utf8'));

/**
 * @method normalizeBooleans
 * @description Recursively mutates jsonld boolean values
 * (for example `{"@value": "true", "@type": "xsd:boolean"}`)
 * to native javascript booleans.
 * @param {@} node
 * @returns
 */
const normalizeBooleans = (node) => {
  if (!node || typeof node !== 'object') return;
  Object.keys(node).forEach(k => {
    const v = node[k];
    if (Array.isArray(v)) {
      v.forEach(normalizeBooleans);
    } else if (v && typeof v === 'object') {
      if (
        v['@value'] !== undefined &&
        (v['@type'] === 'xsd:boolean' || v['@type'] === 'http://www.w3.org/2001/XMLSchema#boolean')
      ) {
        node[k] = (v['@value'] === true || v['@value'] === 'true');
      } else {
        normalizeBooleans(v);
      }
    }
  });
};

/**
 * @method normalizeScalars
 * @description Recursively mutates jsonld scalar values (boolean, integer, string,
 * for example `{"@value": "true", "@type": "xsd:boolean"}`)
 * to native javascript types.
 * @param {@} node
 * @returns
 */
const normalizeScalars = (node) => {
  if (!node || typeof node !== 'object') return;
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach(normalizeScalars);
    else if (v && typeof v === 'object' && '@value' in v) {
      if (v['@type'] === 'xsd:boolean') node[k] = v['@value'] === true || v['@value'] === 'true';
      else if (v['@type'] === 'xsd:integer') node[k] = parseInt(v['@value'], 10);
      else node[k] = v['@value'];
    } else if (v && typeof v === 'object') normalizeScalars(v);
  }
}

/**
 * @method normalizeUnicodeSpacesDeep
 * @description Recursively mutates jsonld string values to replace
 * various unicode space characters with regular spaces.
 * Some descriptions in works/grants contain different types of spaces
 * which causes issues during diff comparisons.
 *
 * The following unicode space characters are targeted:
 * ```
 * \u00A0 - Non-breaking space (NBSP)
 * \u202F - Narrow no-break space
 * \u2007 - Figure space
 * \u2000-\u200A - Various em/en spaces, thin spaces, hair spaces, etc.
 * \u205F - Medium mathematical space
 * ```
 * @param {Object} graph
 * @returns {Object} updated graph
 */
const normalizeUnicodeSpacesDeep = (graph) => {
  const seen = new WeakSet();
  const SPACE_RE = /[\u00A0\u202F\u2007\u2000-\u200A\u205F]/g;

  const fixString = (s) => {
    if (typeof s !== 'string') return s;
    return s.replace(SPACE_RE, ' ');
  };

  const recurse = (node) => {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);

    for (const key of Object.keys(node)) {
      const v = node[key];
      if (typeof v === 'string') {
        node[key] = fixString(v);
      } else if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          if (typeof v[i] === 'string') v[i] = fixString(v[i]);
          else if (v[i] && typeof v[i] === 'object') recurse(v[i]);
        }
      } else if (v && typeof v === 'object') {
        recurse(v);
      }
    }
  };

  graph.forEach(n => recurse(n));
  return graph;
};

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
  const primitivePattern = /("(?:\\.|[^"\\])*"|[-+]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/;
  const re = new RegExp(
    '\\[\\n\\s*' + primitivePattern.source + '\\n\\s*\\]',
    'g'
  );
  return jsonText.replace(re, '[$1]');
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

  compacted["@graph"] = compacted["@graph"].filter(
    node => !(typeof node['@id'] === 'string' && node['@id'].includes('/relationship/'))
  );

  if (compacted["@graph"] && Array.isArray(compacted["@graph"])) {
    const expertNodes = [];
    const workNodes = [];
    const grantNodes = [];
    const otherNodes = [];

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

      if (isExpert) expertNodes.push(node);
      else if (isWork) workNodes.push(node);
      else if (isGrant) grantNodes.push(node);
      else otherNodes.push(node);
    });

    compacted["@graph"] = [...expertNodes, ...workNodes, ...grantNodes, ...otherNodes];
  }

  compacted["@id"] = expertId;
  compacted["@context"] = (config?.server?.url || 'https://stage.experts.library.ucdavis.edu') + "/api/schema/context.jsonld";

  compacted = promoteExpertNodeToRoot(compacted, config);
  updateGrantRelatedByRelates(compacted);

  return compacted;
}

/**
 * @method readRelationshipFiles
 * @description Reads all relationship files for a given expert in the `/expertId/rel` directory,
 * identifies the type of relationship, links the roles in relatedBy, and returns the deduped/combined array.
 * @param {*} cacheUsername
 * @param {*} expertId
 * @returns
 */
async function readRelationshipFiles(cacheUsername, expertId) {
  const relDir = path.join(config.cache.aeStdFormatDir, expertId, 'rel');
  const relCachePath = cache.getPath(cacheUsername, relDir);

  logger.info(`Reading relationship files from: ${relCachePath}`);
  let combinedGraph = [];

  try {
    if (!await cache.exists(relCachePath)) {
      logger.warn(`Relationship directory does not exist: ${relCachePath}`);
      return combinedGraph;
    }

    const files = (await cache.readdir(relCachePath)).files.filter(f => f.filename.endsWith('.jsonld'));
    logger.info(`Found ${files.length} relationship files`);

    for (const file of files) {
      const filePath = file.filepath;
      let relationshipData;
      try {
        relationshipData = JSON.parse(await cache.read(filePath));
      } catch(e) {
        logger.error(`Error parsing ${file}: ${e.message}`);
        continue;
      }

      let graphItems = Array.isArray(relationshipData)
        ? relationshipData
        : Array.isArray(relationshipData['@graph'])
          ? relationshipData['@graph']
          : [relationshipData];

      const byId = new Map();
      graphItems.forEach(n => {
        if (n && n['@id']) byId.set(n['@id'], n);
      });

      const grants = [];
      const works = [];
      const roles = [];

      graphItems.forEach(node => {
        if (!node || !node['@type']) return;
        const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
        if (types.some(t => t.includes('Grant'))) grants.push(node);
        else if (types.some(t => t.includes('Work') || t.includes('Article') || t.includes('Publication'))) works.push(node);
        else if (types.some(t => t.includes('ResearcherRole') || t.includes('GrantRole') || t.includes('Authorship'))) roles.push(node);
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

      const augmentTargets = new Set();
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
              augmentTargets.add(rid);
            }
        });
      });

      combinedGraph.push(...graphItems);
      logger.info(`Added ${graphItems.length} nodes from ${file} (grants=${grants.length}, works=${works.length}, roles=${roles.length})`);
    }

    const dedup = new Map();
    combinedGraph.forEach(n => {
      if (n && n['@id']) dedup.set(n['@id'], n);
    });
    combinedGraph = Array.from(dedup.values());
    logger.info(`Combined graph node count after dedupe: ${combinedGraph.length}`);

  } catch (e) {
    logger.error(`Error reading relationship directory: ${e.message}`);
  }

  return combinedGraph;
}

async function runFromFiles(cacheUsername) {
  logger.info(`Running AE webapp transformation for user: ${cacheUsername}`);

  // Read the main expert graph
  const expertGraph = JSON.parse(await cache.readUserAsset(cacheUsername, 'ae-std/person.jsonld'));
  
  // Get expert ID
  let expertId = expertGraph.find(n => n['@type'] && n['@type'].includes('http://schema.library.ucdavis.edu/schema#Expert'));
  expertId = expertId['@id'].replace('http://experts.ucdavis.edu/expert/', '');

  // Read all relationship files (works/grants)
  const relationshipGraph = await readRelationshipFiles(cacheUsername, expertId);

  const combinedGraph = Array.isArray(expertGraph)
    ? [...expertGraph, ...relationshipGraph]
    : [expertGraph, ...relationshipGraph];

  let framed = await frame(expertId, combinedGraph);
  framed = sortJsonRecursively(framed);

  // generate files
  const expertFile = await generateExpertFile(cacheUsername, framed, { collapseSingleItemPrimitiveArrays });
  const workFiles = await generateWorkFiles(cacheUsername, expertId, framed, { collapseSingleItemPrimitiveArrays });
  const grantFiles = await generateGrantFiles(cacheUsername, expertId, framed, { collapseSingleItemPrimitiveArrays });

  return {
    expertFile,
    workFiles,
    grantFiles
  };
}

export {
  runFromFiles,
  frame,
  readRelationshipFiles,
  collapseSingleItemPrimitiveArrays
};
