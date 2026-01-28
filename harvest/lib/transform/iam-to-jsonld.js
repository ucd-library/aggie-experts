import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';

function mapLegacyKeysToJsonLd(node) {
  if (node === null || node === undefined) return node;
  if (Array.isArray(node)) return node.map(mapLegacyKeysToJsonLd);
  if (typeof node !== 'object') return node;

  for (const k of Object.keys(node)) {
    node[k] = mapLegacyKeysToJsonLd(node[k]);
  }

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

/**
 * @function iamApiToJsonLd
 * @description Converts IAM API response to JSON-LD.
 *
 * @param {String} jsonFile - The path to the json response file on disk
 * @return {Promise<void>} - Resolves when the conversion is complete
 */
async function iamApiToJsonLd(jsonFile) {
  let jsonldFile = jsonFile.replace(/\.json$/, '.jsonld');
  logger.info(`Converting IAM API response to JSON-LD: ${jsonFile} -> ${jsonldFile}`);

  let res = JSON.parse(await cache.read(jsonFile));

  let graph = {
    ... config.iam.context,
    "@id" : 'ark:/87287/d7c08j/',
    "@graph" : res.responseData.results || []
  };

  // Normalize legacy keys into JSON-LD safe keys before writing
  try {
    mapLegacyKeysToJsonLd(graph);
    if ('@graph' in graph && graph['@graph'] && !Array.isArray(graph['@graph'])) {
      graph['@graph'] = [graph['@graph']];
    }
  } catch (e) {
    logger.warn('Error normalizing legacy keys for iam-to-jsonld', e);
  }

  await cache.write('iam-to-jsonld-transform', jsonldFile, graph);

  return {jsonldFile, graph};
}

export default iamApiToJsonLd;
