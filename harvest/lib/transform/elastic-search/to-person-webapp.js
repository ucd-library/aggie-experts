import path from 'path';
import logger from '../../logger.js';
import config from '../../config.js';
import cache from '../../cache.js';

/**
 * @method generateExpertFile
 * @description Generates the expert file for Elasticsearch in the webapp format.
 * @param {*} cacheUsername the cache username
 * @param {*} framedDocument the framed document to transform
 * @param {*} utils functions used for transformations
 * @returns {*} the cached file write response
*/
async function generateExpertFile(cacheUsername, framedDocument, utils = {}) {
  const { collapseSingleItemPrimitiveArrays } = utils;

  try {
    let outputText = JSON.stringify(framedDocument, null, 2);

    if (collapseSingleItemPrimitiveArrays) {
      outputText = collapseSingleItemPrimitiveArrays(outputText);
    }

    const expertFile = await cache.writeUserAsset(
      'ae-webapp-expert-transform',
      cacheUsername,
      path.join(config.cache.aeWebappDir, 'webapp.expert.jsonld'),
      outputText
    );

    logger.info('Generated expert file: webapp.expert.jsonld');
    return expertFile;

  } catch (error) {
    logger.error(`Error generating expert file: ${error.message}`);
    throw error;
  }
}

/**
 * @method getExpertNode
 * @description Extract expert node from framed document
 * Prefer the node whose @id matches the document root @id when available.
 * @param {*} framedDocument the framed document to extract from
 */
function getExpertNode(framedDocument) {
  const graph = Array.isArray(framedDocument?.['@graph']) ? framedDocument['@graph'] : [];
  const isExpert = (n) => n && (n['@type'] === 'Expert' || (Array.isArray(n['@type']) && n['@type'].includes('Expert')));

  // First try to match the root @id (primary expert for this document)
  const rootId = framedDocument && framedDocument['@id'];
  if (rootId) {
    const byRoot = graph.find(n => isExpert(n) && n['@id'] === rootId);
    if (byRoot) return byRoot;
  }

  // Fallback to the first Expert node
  return graph.find(isExpert);
}

/**
 * @method createSimplifiedExpert
 * @description Create a simplified expert node for inclusion in other documents
 * @param {*} expertNode the source expert node
 * @return {*} the simplified expert node
 */
function createSimplifiedExpert(expertNode) {
  if (!expertNode) return null;

  // Prefer explicit contactInfo entries if present
  let contact = null;
  if (expertNode.contactInfo) {
    const infos = Array.isArray(expertNode.contactInfo) ? expertNode.contactInfo.slice() : [expertNode.contactInfo];
    infos.sort((a, b) => ( (a.rank || 100) - (b.rank || 100) ));
    contact = infos[0];
  }

  // Fallback to top-level name if no contact info
  const name = (contact && contact.name) ? contact.name : (expertNode.name || expertNode.label);

  // Build contactInfo entry preserving hasName object and hasEmail when present
  let contactInfoEntry = null;
  if (contact) {
    contactInfoEntry = {};
    if (contact.hasEmail) contactInfoEntry.hasEmail = contact.hasEmail;
    if (contact.hasName) contactInfoEntry.hasName = { ...contact.hasName };
    if (contact.name) contactInfoEntry.name = contact.name;
  }

  return {
    "@id": expertNode["@id"],
    "@type": "Expert",
    "contactInfo": contactInfoEntry ? [contactInfoEntry] : [],
    "is-visible": expertNode["is-visible"],
    "name": name
  };
}

/**
 * @method promoteExpertNodeToRoot
 * @description Promotes the expert node to the root of the document,
 * restructures the document to have several properties at the top level.
 *
 * This is pulled from the fin model in AEv2.
 * @param {*} compacted the compacted JSON-LD document
 * @param {*} config the config object with context properties
 * @returns {*} the restructured document
 */
function promoteExpertNodeToRoot(compacted, config) {
  if( typeof compacted["is-visible"] === 'object' ) delete compacted["is-visible"];

  const graph = Array.isArray(compacted?.['@graph']) ? compacted['@graph'] : [];
  const isExpert = (n) => n && (n['@type'] === 'Expert' || (Array.isArray(n['@type']) && n['@type'].includes('Expert')));

  const normalizeShortId = (id) => {
    if (!id || typeof id !== 'string') return id;
    if (id.startsWith('http://experts.ucdavis.edu/expert/')) return id.replace('http://experts.ucdavis.edu/expert/', '');
    if (id.startsWith('expert/')) return id.replace(/^expert\//, '');
    return id;
  };

  const rootShort = normalizeShortId(compacted && compacted['@id']);

  // Prefer the expert whose @id matches the document root @id
  let expertNode = graph.find(n => isExpert(n) && normalizeShortId(n['@id']) === rootShort);
  // Fallback to the first Expert node if no match found
  if (!expertNode) {
    expertNode = graph.find(isExpert);
  }
  if (!expertNode) return compacted;

  const canonicalRootId = rootShort ? `expert/${rootShort}` : expertNode['@id'];

  const doc = {
    "@id": canonicalRootId,
    "@context": (config?.server?.url || 'https://stage.experts.library.ucdavis.edu') + "/api/schema/context.jsonld",
    "@graph": compacted["@graph"],
    "@type": "Expert"
  };

  if( typeof expertNode["is-visible"] === 'object' ) delete expertNode["is-visible"];

  if( expertNode["is-visible"] !== undefined ) {
    doc["is-visible"] = expertNode["is-visible"];
  }
  if (expertNode["hasAvailability"]) {
    doc["hasAvailability"] = Array.isArray(expertNode["hasAvailability"])
      ? [...expertNode["hasAvailability"]]
      : [expertNode["hasAvailability"]];
  }

  let contact = null;
  let hasEmail = [];
  let hasURL = [];
  if (expertNode["contactInfo"]) {
    let contactInfos = Array.isArray(expertNode["contactInfo"]) ? expertNode["contactInfo"] : [expertNode["contactInfo"]];
    contactInfos.sort((a, b) => (a["rank"] || 100) - (b["rank"] || 100));
    contact = contactInfos[0];
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

  doc["@graph"] = compacted["@graph"];

  return doc;
}

/**
 * @method normalizeExpertIdsDeep
 * @description Recursively normalizes all expert IDs in the graph to ensure they do not have duplicate 'expert/expert/' segments.
 * @param {*} graph the JSON-LD graph to normalize
 * @returns {*} the normalized graph
 */
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

    if (node['@id']) {
      node['@id'] = fixIdString(node['@id']);
    }

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

export {
  generateExpertFile,
  getExpertNode,
  createSimplifiedExpert,
  normalizeExpertIdsDeep,
  promoteExpertNodeToRoot
};
