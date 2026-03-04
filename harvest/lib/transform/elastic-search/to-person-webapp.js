import path from 'path';
import { logger, config } from '@ucd-lib/experts-commons';
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
      cacheUsername,
      'webapp.expert.jsonld',
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




export {
  generateExpertFile,
  getExpertNode,
  createSimplifiedExpert,
  promoteExpertNodeToRoot
};
