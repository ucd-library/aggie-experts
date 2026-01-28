import logger from '../logger.js';
import { XMLParser } from 'fast-xml-parser';


// Note: cache and fs are intentionally not imported here to keep this module
// lightweight and easily testable. Other modules should handle caching/writing.

function normalizeTextNodes(node) {
  if (node === null || node === undefined) return node;
  if (Array.isArray(node)) return node.map(normalizeTextNodes);
  if (typeof node === 'object') {
    // First recursively normalize children
    for (const k of Object.keys(node)) {
      node[k] = normalizeTextNodes(node[k]);
    }
    // If this object only contains a text node, replace it with the text value
    const keys = Object.keys(node);
    if (keys.length === 1 && (keys[0] === '#text' || keys[0] === 'text')) {
      return node[keys[0]];
    }
  }
  return node;
}

// Structural/key normalization to make fast-xml-parser output compatible
// with the previous xml2json shape and downstream AE std transforms.
function normalizeStructure(node) {
  if (node === null || node === undefined) return node;
  if (Array.isArray(node)) return node.map(normalizeStructure);
  if (typeof node !== 'object') return node;

  // Preserve original id/type/$t keys to maintain compatibility with legacy
  // extractors. Mapping to @id/@type/#text is performed in JSON-LD writers
  // (jsonatom-to-jsonld.js, iam-to-jsonld.js) before cache.write.

  // If @graph exists but is an object, wrap it into an array
  if ('@graph' in node && node['@graph'] && !Array.isArray(node['@graph'])) {
    node['@graph'] = [node['@graph']];
  }

  // Normalize api:native empty-string -> empty object to match previous xml2json behavior
  if ('api:native' in node && node['api:native'] === '') {
    node['api:native'] = {};
  }

  // Recurse into children
  for (const k of Object.keys(node)) {
    node[k] = normalizeStructure(node[k]);
  }

  return node;
}

// New: normalize primitive-like strings into native booleans/integers where appropriate
function normalizePrimitives(node) {
  if (node === null || node === undefined) return node;
  if (Array.isArray(node)) return node.map(normalizePrimitives);
  if (typeof node === 'object') {
    for (const k of Object.keys(node)) {
      node[k] = normalizePrimitives(node[k]);
    }
    return node;
  }
  if (typeof node === 'string') {
    const s = node.trim();
    if (/^-?\d+$/.test(s)) {
      // integer
      const n = parseInt(s, 10);
      return isNaN(n) ? node : n;
    }
    if (s === 'true') return true;
    if (s === 'false') return false;
    return node;
  }
  return node;
}

/**
 * @function xmlToJson
 * @description Converts XML to JSON format.
 * 
 * @param {String} xml - xml string
 * 
 * @return {Promise<void>} - Resolves when the conversion is complete
 */
async function xmlToJson(xml) {
  logger.info(`Converting XML to JSON`);
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      trimValues: true,
      // prevent coercion of attribute and node values where possible
      parseAttributeValue: false,
      parseNodeValue: false,
      // do not always create text nodes; let parser create them only when needed
      // (fast-xml-parser creates '#text' for mixed content)
    });

    let json = parser.parse(xml);

    // If parser produced the XML prolog wrapper, keep the top-level feed wrapper
    if (json && json['?xml'] && json.feed) {
      json = { feed: json.feed };
    }

    // Normalize simple text-only nodes to plain strings so downstream code that
    // expected xml2json output (string for simple elements) continues to work.
    json = normalizeTextNodes(json);

    // Structural normalization: ensure @graph is an array, map id/type to @id/@type,
    // and normalize other common variants ($t -> #text).
    json = normalizeStructure(json);

    // Normalize primitive-like strings into native booleans/integers
    json = normalizePrimitives(json);

    return json;
  } catch (e) {
    logger.error('Error parsing XML to JSON', e);
    throw e;
  }
}

export default xmlToJson;