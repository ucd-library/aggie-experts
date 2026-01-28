import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';
import path from 'path';

/**
 * @function jsonAtomToJsonLd
 * @description Converts JSONified Atom format from cdl to JSON-LD.
 * 
 * @param {String} jsonAtomFile - The path to the JSON Atom file on disk
 * @return {Promise<void>} - Resolves when the conversion is complete
 */
async function jsonAtomToJsonLd(jsonAtomFile) {
  let parts = path.parse(jsonAtomFile); // Ensure the file path is valid
  let jsonldFile = path.join(path.resolve(parts.dir, '..'), parts.name + '.jsonld');

  logger.info(`Converting JSON-Atom to JSON-LD: ${jsonAtomFile} -> ${jsonldFile}`);

  let atom = JSON.parse(await cache.read(jsonAtomFile));
  let graph = Object.assign({}, config.cdl.context);
  graph['@graph'] = atom.feed.entry || [];

  // Normalize legacy keys (id/type/$t) into JSON-LD safe keys (@id/@type/#text)
  try {
    // Map the whole graph so mapper can normalize/wrap @graph properly
    mapLegacyKeysToJsonLd(graph);
    if ('@graph' in graph && graph['@graph'] && !Array.isArray(graph['@graph'])) {
      graph['@graph'] = [graph['@graph']];
    }
  } catch (e) {
    logger.warn('Error normalizing legacy keys for jsonatom-to-jsonld', e);
  }

  await cache.write('jsonatom-to-jsonld-transform', jsonldFile, graph);

  return {jsonldFile, graph};
}

/**
 * @function mapLegacyKeysToJsonLd
 * @description Recursively walks JSON structure mapping legacy id/type/$t keys to JSON-LD safe @id/@type/#text
 * 
 * @param {Object|Array} node - The JSON object or array to normalize
 * @return {Object|Array} - The normalized JSON object or array
 */
function mapLegacyKeysToJsonLd(node) {
  if (node === null || node === undefined) return node;
  if (Array.isArray(node)) return node.map(mapLegacyKeysToJsonLd);
  if (typeof node !== 'object') return node;

  // If @graph exists but is an object, wrap it into an array
  if ('@graph' in node && node['@graph'] && !Array.isArray(node['@graph'])) {
    node['@graph'] = [node['@graph']];
  }

  // Walk object keys and map legacy id/type/$t -> @id/@type/#text, deleting originals
  for (const k of Object.keys(node)) {
    const v = node[k];

    // map child nodes first
    node[k] = mapLegacyKeysToJsonLd(v);
  }

  // After mapping children, perform key-level renames on this object
  if ('id' in node) {
    if (!('@id' in node)) {
      const val = node['id'];
      node['@id'] = (typeof val === 'number') ? String(val) : val;
    }
    delete node['id'];
  }
  if ('type' in node) {
    if (!('@type' in node)) node['@type'] = node['type'];
    delete node['type'];
  }
  if ('$t' in node) {
    if (!('#text' in node)) node['#text'] = node['$t'];
    delete node['$t'];
  }

  // Ensure @id is always a string to avoid JSON-LD expansion errors
  if ('@id' in node && typeof node['@id'] !== 'string') {
    try { node['@id'] = String(node['@id']); } catch (e) { /* ignore */ }
  }

  return node;
}

export default jsonAtomToJsonLd;