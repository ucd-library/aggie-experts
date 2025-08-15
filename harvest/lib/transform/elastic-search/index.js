import fs from 'fs-extra';
import path from 'path';
import jsonld from 'jsonld';
import logger from '../../logger.js';
import config from '../../config.js';
import cache from '../../cache.js';

import {sortJsonRecursively} from '../utils.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const contextPath = path.join(__dirname, 'schema', '4', 'context.jsonld');
const contextFile = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
const framePath = path.join(__dirname, 'frames', 'default.json');
const frameFile = JSON.parse(fs.readFileSync(framePath, 'utf8'));


async function frame(expertId, graph, expertGraph = null) {
  // Source item passed to framing
  const item = {
    "@id": "info:fedora" + expertId,
    "@version": 1.1,
    "@graph": graph
  };

  const frameDoc = {
    ...frameFile
  };
  frameDoc["@context"] = contextFile["@context"];

  const normalizeExpertIdsDeep = (graph) => {
    const seen = new WeakSet();

    const fixIdString = (val) => {
      if (typeof val === 'string' && val.startsWith('expert/expert/')) {
        return val.replace(/^expert\/expert\//, 'expert/');
      }
      return val;
    };

    const recurse = (node) => {
      if (!node || typeof node !== 'object') return;
      if (seen.has(node)) return;
      seen.add(node);

      // If this object itself has an @id
      if (node['@id']) {
        node['@id'] = fixIdString(node['@id']);
      }

      // Iterate properties
      for (const key of Object.keys(node)) {
        const v = node[key];

        if (Array.isArray(v)) {
          for (let i = 0; i < v.length; i++) {
            if (v[i] && typeof v[i] === 'object') {
              recurse(v[i]);
            } else {
              v[i] = fixIdString(v[i]);
            }
          }
        } else if (v && typeof v === 'object') {
          recurse(v);
        } else {
          node[key] = fixIdString(v);
        }
      }
    };

    graph.forEach(n => recurse(n));
    return graph;
  }

  // JSON-LD framing with full embedding
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

  // Compact to collapse value objects using the same context
  let compacted = await jsonld.compact(framedRaw, contextFile["@context"], {
    embed: '@always'
  });

  // Ensure @graph is always an array
  if (!Array.isArray(compacted["@graph"])) {
    compacted["@graph"] = compacted["@graph"] ? [compacted["@graph"]] : [];
  }

  compacted["@graph"] = normalizeExpertIdsDeep(compacted["@graph"]);

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

  compacted['@graph'].forEach(normalizeScalars);
  compacted["@graph"].forEach(normalizeBooleans);

  // Order authors by rank
  compacted["@graph"].forEach(node => {
    if (node?.author) {
      if (!Array.isArray(node.author)) {
        node.author = [node.author];
      }
      node.author.sort((a, b) => (a?.rank || 0) - (b?.rank || 0));
    }
  });

  // Filter out relationship nodes (those whose @id contains '/relationship/', included previously so we could embed their content)
  compacted["@graph"] = compacted["@graph"].filter(
    node => !(typeof node['@id'] === 'string' && node['@id'].includes('/relationship/'))
  );

  // Reorder: expert first, then works, then grants, then others
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

  // Set clean @id and final public context (public URL)
  compacted["@id"] = expertId;
  compacted["@context"] = (config?.server?.url || 'https://stage.experts.library.ucdavis.edu') + "/api/schema/context.jsonld";

  compacted = promoteExpertNodeToRoot(compacted, config);

  // this is taken from the grant model update function,
  //  relatedBy.relates is updated with expertId + name/label
  updateGrantRelatedByRelates(compacted);

  return compacted;
}

/**
 * @method updateGrantRelatedByRelates
 * @description update relatedBy.relates field in Grant nodes with expertId + name/label.
 * taken from the grant model update (and related) function
 *
 * @param {Object} compacted - The compacted JSON-LD document
*/
function updateGrantRelatedByRelates(compacted) {
  // Find the expert node and get its @id and label/name
  const expertNode = compacted["@graph"].find(
    n => n && (n["@type"] === "Expert" || (Array.isArray(n["@type"]) && n["@type"].includes("Expert")))
  );
  if (!expertNode) return;

  const expertIdStr = expertNode['@id'];
  const expertLabel = expertNode.label || expertNode.name;

  // Only update Grant nodes
  compacted["@graph"].forEach(node => {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (!types.some(t => t.includes('Grant'))) return;

    if (Array.isArray(node.relatedBy)) {
      node.relatedBy.forEach(role => {
        if (role && role.relates) {
          if (Array.isArray(role.relates)) {
            role.relates = role.relates.map(r =>
              (typeof r === "string" && r === expertIdStr) ||
              (r && r["@id"] === expertIdStr)
                ? { "@id": expertIdStr, "name": expertLabel }
                : r
            );
          } else if (
            (typeof role.relates === "string" && role.relates === expertIdStr) ||
            (role.relates && role.relates["@id"] === expertIdStr)
          ) {
            role.relates = { "@id": expertIdStr, "name": expertLabel };
          }
        }
      });
    }
  });
}

/**
 * @method promoteExpertNodeToRoot
 * @description promote fields to the document root
 * taken from the expert model update (and related) functions
 *
 * @param {Object} compacted - The compacted JSON-LD document
*/
function promoteExpertNodeToRoot(compacted, config) {
  // Find the expert node
  const expertNode = compacted["@graph"].find(
    n => n && (n["@type"] === "Expert" || (Array.isArray(n["@type"]) && n["@type"].includes("Expert")))
  );
  if (!expertNode) return compacted;

  // Build the root doc
  const doc = {
    "@id": expertNode['@id'],
    "@context": (config?.server?.url || 'https://stage.experts.library.ucdavis.edu') + "/api/schema/context.jsonld",
    "@graph": compacted["@graph"],
    "@type": "Expert"
  };

  // Add visibility
  if (expertNode["is-visible"] !== undefined) {
    doc["is-visible"] = expertNode["is-visible"];
  }
  if (expertNode["hasAvailability"]) {
    doc["hasAvailability"] = Array.isArray(expertNode["hasAvailability"])
      ? [...expertNode["hasAvailability"]]
      : [expertNode["hasAvailability"]];
  }

  // Order the vcards, and get the first one
  let contact = null;
  let hasEmail = [];
  let hasURL = [];
  if (expertNode["contactInfo"]) {
    let contactInfos = Array.isArray(expertNode["contactInfo"])
      ? expertNode["contactInfo"]
      : [expertNode["contactInfo"]];
    contactInfos.sort((a, b) => (a["rank"] || 100) - (b["rank"] || 100));
    contact = contactInfos[0];
    // get the hasURL and hasEmail
    contactInfos.forEach((info) => {
      if (info.hasEmail) hasEmail = hasEmail.concat(info.hasEmail);
      if (info?.hasURL) hasURL = hasURL.concat(info.hasURL);
    });
  }

  doc["contactInfo"] = {};
  if (hasURL.length > 0) doc.contactInfo["hasURL"] = hasURL;
  doc.contactInfo["hasEmail"] = hasEmail?.[0];

  ["name", "hasName", "hasTitle", "hasOrganizationalUnit"].forEach((key) => {
    if (contact && contact[key]) {
      doc.contactInfo[key] = contact[key];
    }
  });
  if (doc.contactInfo.name) {
    doc.name = doc.contactInfo.name;
  }
  if (expertNode["modified-date"]) {
    doc["modified-date"] = expertNode["modified-date"];
  }
  if (expertNode["roles"]) {
    doc["roles"] = expertNode["roles"];
  }

  // Add the full @graph as well (for downstream use)
  doc["@graph"] = compacted["@graph"];

  return doc;
}

async function readRelationshipFiles(cacheUsername, expertId) {
  const relDir = path.join(config.cache.aeStdFormatDir, expertId, 'rel');
  const relCachePath = cache.getPath(cacheUsername, relDir);

  logger.info(`Reading relationship files from: ${relCachePath}`);
  let combinedGraph = [];

  try {
    if (!fs.existsSync(relCachePath)) {
      logger.warn(`Relationship directory does not exist: ${relCachePath}`);
      return combinedGraph;
    }

    const files = fs.readdirSync(relCachePath).filter(f => f.endsWith('.jsonld'));
    logger.info(`Found ${files.length} relationship files`);

    for (const file of files) {
      const filePath = path.join(relCachePath, file);
      let relationshipData;
      try {
        relationshipData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch(e) {
        logger.error(`Error parsing ${file}: ${e.message}`);
        continue;
      }

      let graphItems = Array.isArray(relationshipData)
        ? relationshipData
        : Array.isArray(relationshipData['@graph'])
          ? relationshipData['@graph']
          : [relationshipData];

      // Index all nodes by @id
      const byId = new Map();
      graphItems.forEach(n => {
        if (n && n['@id']) byId.set(n['@id'], n);
      });

      // Identify grants, works, role (relationship) nodes
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

      // Helper to pull relates predicate variants
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

      // Attach roles to their target grant/work via relatedBy, but DO NOT drop any nodes
      const augmentTargets = new Set();
      roles.forEach(role => {
        const relatedIds = getRelatesIds(role);
        relatedIds.forEach(rid => {
          const target = byId.get(rid);
            if (target) {
              if (!target.relatedBy) target.relatedBy = [];
              else if (!Array.isArray(target.relatedBy)) target.relatedBy = [target.relatedBy];
              // Avoid duplicate role insertion
              if (!target.relatedBy.find(rb => rb['@id'] === role['@id'])) {
                target.relatedBy.push({"@id": role['@id']});
                // target.relatedBy.push(role);
              }
              augmentTargets.add(rid);
            }
        });
      });

      // Keep ALL nodes (so funder, interval, date, vcard nodes remain)
      combinedGraph.push(...graphItems);
      logger.info(`Added ${graphItems.length} nodes from ${file} (grants=${grants.length}, works=${works.length}, roles=${roles.length})`);
    }

    // De-duplicate by @id across files
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

async function runFromFiles(cacheUsername, expertId, file) {
  logger.info(`Running AE webapp transformation for user: ${cacheUsername}`);

  // Read the main expert graph
  const expertGraph = JSON.parse(fs.readFileSync(file, 'utf8'));

  // Read all relationship files (works/grants)
  const relationshipGraph = await readRelationshipFiles(cacheUsername, expertId);

  // Combine expert and relationship graphs
  const combinedGraph = Array.isArray(expertGraph)
    ? [...expertGraph, ...relationshipGraph]
    : [expertGraph, ...relationshipGraph];

  logger.info(`Total items in combined graph: ${combinedGraph.length}`);

  // Frame the combined graph
  let framed = await frame(expertId, combinedGraph);

  // TEMP remove, just diffing
  framed = sortJsonRecursively(framed);

  return cache.writeUserAsset(
    'ae-webapp-expert-transform',
    cacheUsername,
    path.join(config.cache.aeWebappDir, 'webapp.expert.jsonld'),
    framed
  );
}

export {
  runFromFiles,
  frame,
  readRelationshipFiles
};
