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
    // Normalize simple text-only nodes to plain strings so downstream code that
    // expected xml2json output (string for simple elements) continues to work.
    json = normalizeTextNodes(json);
    return json;
  } catch (e) {
    logger.error('Error parsing XML to JSON', e);
    throw e;
  }
}

export default xmlToJson;