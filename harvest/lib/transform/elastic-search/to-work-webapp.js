import path from 'path';
import logger from '../../logger.js';
import config from '../../config.js';
import cache from '../../cache.js';
import {sortJsonRecursively} from '../utils.js';
import { getExpertNode, createSimplifiedExpert } from './to-person-webapp.js';

/**
 * @method generateWorkFiles
 * @description Generate individual work files for Elasticsearch
 * @param {*} cacheUsername the cache username
 * @param {*} expertId the expert identifier
 * @param {*} framedDocument the framed document to transform
 * @param {*} utils functions used for transformations
 * @returns {*} array of generated work file paths
 */
async function generateWorkFiles(cacheUsername, expertId, framedDocument, utils = {}) {
  const { collapseSingleItemPrimitiveArrays } = utils;
  const workFiles = [];

  // Extract work nodes from the framed document
  const workNodes = framedDocument["@graph"].filter(node => {
    if (!node || !node['@type']) return false;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    return types.some(t =>
      t.includes('Work') ||
      t.includes('ScholarlyArticle') ||
      t.includes('Article') ||
      t.includes('Publication')
    );
  });

  // Get the expert node for reference
  const expertNode = getExpertNode(framedDocument);
  if (!expertNode) {
    logger.warn('No expert node found in framed document');
    return workFiles;
  }

  // Create a simplified expert node for inclusion in work files
  const simplifiedExpert = createSimplifiedExpert(expertNode);
  if (!simplifiedExpert) {
    logger.warn('Could not create simplified expert node');
    return workFiles;
  }

  for (const workNode of workNodes) {
    try {
      // Extract the work ID for filename (remove ark:/ prefix and replace slashes)
      const workId = workNode["@id"];
      const fileId = workId.replace(/^ark:\/87287\/d7mh2m\/publication\//, '');

      // Create the work document structure
      const workDocument = createWorkDocument(workNode, simplifiedExpert, framedDocument);

      // Sort the document
      const sortedDocument = sortJsonRecursively(workDocument);

      // Convert to formatted JSON
      let outputText = JSON.stringify(sortedDocument, null, 2);
      if (collapseSingleItemPrimitiveArrays) {
        outputText = collapseSingleItemPrimitiveArrays(outputText);
      }

      // Write the work file
      const filename = `webapp.work.${fileId}.jsonld`;
      const filePath = path.join(config.cache.aeWebappDir, filename);

      await cache.writeUserAsset(
        'ae-webapp-work-transform',
        cacheUsername,
        filePath,
        outputText
      );

      workFiles.push(filePath);
      logger.info(`Generated work file: ${filename}`);

    } catch (error) {
      logger.error(`Error generating work file for ${workNode["@id"]}: ${error.message}`);
    }
  }

  return workFiles;
}

/**
 * @method createWorkDocument
 * @description Create a work document structure for Elasticsearch
 * @param {*} workNode the source work node
 * @param {*} simplifiedExpert the simplified expert node to include
 * @param {*} framedDocument the original framed document for context
 * @returns {*} the work document structure
 */
function createWorkDocument(workNode, simplifiedExpert, framedDocument) {
  return {
    "@context": framedDocument["@context"],
    "@graph": [
      // Include the work node with all its data
      {
        ...workNode,
        "is-visible": true // Ensure visibility
      },
      // Include simplified expert node
      simplifiedExpert
    ],
    // Root-level properties (same as work node)
    "@id": workNode["@id"],
    "@type": workNode["@type"],
    "DOI": workNode.DOI,
    "_id": workNode["@id"],
    "abstract": workNode.abstract,
    "author": workNode.author,
    "container-title": workNode["container-title"],
    "is-visible": true,
    "issued": workNode.issued,
    "modified-date": workNode["modified-date"] || new Date().toISOString(),
    "name": generateWorkName(workNode),
    "page": workNode.page,
    "roles": ["public"],
    "status": workNode.status,
    "title": workNode.title,
    "type": workNode.type,
    "volume": workNode.volume
  };
}

/**
 * @method generateWorkName
 * @description Generate a formatted work name string
 * @param {*} workNode the source work node
 * @returns {string} the formatted work name
 */
function generateWorkName(workNode) {
  const title = workNode.title || '';
  const status = workNode.status || '';
  const type = workNode.type || '';
  const issued = workNode.issued || '';

  // Extract author names for abbreviated format
  let authorString = '';
  if (workNode.author && Array.isArray(workNode.author) && workNode.author.length > 0) {
    const firstAuthor = workNode.author[0];
    const lastAuthor = workNode.author[workNode.author.length - 1];

    if (workNode.author.length === 1) {
      authorString = `${firstAuthor.family}, ${firstAuthor.given?.charAt(0) || ''}`;
    } else if (workNode.author.length === 2) {
      authorString = `${firstAuthor.family}, ${firstAuthor.given?.charAt(0) || ''}. & ${lastAuthor.family}, ${lastAuthor.given?.charAt(0) || ''}.`;
    } else {
      authorString = `${firstAuthor.family}, ${firstAuthor.given?.charAt(0) || ''}. & ${lastAuthor.family}, ${lastAuthor.given?.charAt(0) || ''}. et al.`;
    }
  }

  const containerTitle = workNode["container-title"] || '';
  const eissn = workNode.eissn || '';
  const doi = workNode.DOI || '';

  return `${title} § ${status} • ${type} • ${issued} • ${authorString} § ${containerTitle} • ${eissn} § ${doi}`;
}

/**
 * @method getWorkNodes
 * @description Extract work nodes from a framed document
 * @param {*} framedDocument the framed document to extract from
 * @returns {Array} array of work nodes
 */
function getWorkNodes(framedDocument) {
  return framedDocument["@graph"].filter(node => {
    if (!node || !node['@type']) return false;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    return types.some(t =>
      t.includes('Work') ||
      t.includes('ScholarlyArticle') ||
      t.includes('Article') ||
      t.includes('Publication')
    );
  });
}

export {
  generateWorkFiles,
  createWorkDocument,
  generateWorkName,
  getWorkNodes
};
