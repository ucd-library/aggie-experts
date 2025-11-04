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
  const relatedBy = buildWorkRelatedBy(workNode, simplifiedExpert);

  return {
    "@context": framedDocument["@context"],
    "@graph": [
      // Include the work node with all its data
      {
        ...workNode,
        "is-visible": true,
        "relatedBy": relatedBy
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
    "relatedBy": "foo", // relatedBy,
    "roles": ["public"],
    "universe" : "42",
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

/**
 * @method updateWorkRelatedByRelates
 * @description Update relatedBy relates fields in work nodes to use string expert references
 * Similar to grant pattern but adapted for work authorships
 * @param {*} workDocument the work document containing work and expert nodes
 */
function updateWorkRelatedByRelates(workDocument) {
  // Find the expert node
  const expertNode = workDocument["@graph"].find(
    n => n && (n["@type"] === "Expert" || (Array.isArray(n["@type"]) && n["@type"].includes("Expert")))
  );
  if (!expertNode) return;

  const expertIdStr = expertNode['@id'];

  // Find the work node
  workDocument["@graph"].forEach(node => {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    const isWork = types.some(t =>
      t.includes('Work') ||
      t.includes('ScholarlyArticle') ||
      t.includes('Article') ||
      t.includes('Publication')
    );
    if (!isWork) return;

    // Process relatedBy (authorships)
    if (Array.isArray(node.relatedBy)) {
      node.relatedBy.forEach(authorship => {
        if (authorship && authorship.relates) {
          // Ensure relates is an array
          if (!Array.isArray(authorship.relates)) {
            authorship.relates = [authorship.relates];
          }

          const workId = node['@id'];
          const newRelates = [];

          // Add the work ID if not present
          const hasWork = authorship.relates.some(r =>
            (typeof r === 'string' && r === workId) ||
            (r && r['@id'] === workId)
          );
          if (!hasWork) {
            newRelates.push(workId);
          }

          // Add the expert ID if not present (convert objects to strings)
          const hasExpert = authorship.relates.some(r =>
            (typeof r === 'string' && r === expertIdStr) ||
            (r && r['@id'] === expertIdStr)
          );
          if (!hasExpert) {
            newRelates.push(expertIdStr);
          }

          // Keep all existing IDs (converting objects to strings)
          authorship.relates.forEach(r => {
            const rId = typeof r === 'string' ? r : r['@id'];
            if (rId && !newRelates.includes(rId)) {
              newRelates.push(rId);
            }
          });

          authorship.relates = newRelates;
        }
      });
    }
  });
}

/**
 * @method buildWorkRelatedBy
 * @description Build relatedBy array for a work, ensuring it contains authorships
 * with relates arrays containing both the work ark and expert ark as strings
 * @param {*} workNode the work node
 * @param {*} expertNode the expert node
 * @returns {Array} array of authorship objects with proper relates structure
 */
function buildWorkRelatedBy(workNode, expertNode) {
  const expertIdStr = expertNode['@id'];
  const workId = workNode['@id'];

  // Start with existing relatedBy or empty array
  const relatedBy = Array.isArray(workNode.relatedBy)
    ? [...workNode.relatedBy]
    : (workNode.relatedBy ? [workNode.relatedBy] : []);

  // Process each authorship
  return relatedBy.map(authorship => {
    const updatedAuthorship = { ...authorship };

    // Ensure relates is an array
    if (!updatedAuthorship.relates) {
      updatedAuthorship.relates = [];
    } else if (!Array.isArray(updatedAuthorship.relates)) {
      updatedAuthorship.relates = [updatedAuthorship.relates];
    }

    // Build proper relates array with work and expert references as strings
    const newRelates = [workId]; // Always include the work/publication ark

    // Add expert ID if not already present
    if (!updatedAuthorship.relates.includes(expertIdStr)) {
      newRelates.push(expertIdStr);
    }

    // Keep any other expert IDs that might exist (handle both string and object formats)
    updatedAuthorship.relates.forEach(r => {
      const rId = typeof r === 'string' ? r : r['@id'];
      if (rId && rId !== workId && rId !== expertIdStr && rId.match(/^expert/)) {
        newRelates.push(rId);
      }
    });

    updatedAuthorship.relates = newRelates;
    return updatedAuthorship;
  });
}

export {
  generateWorkFiles,
  createWorkDocument,
  generateWorkName,
  getWorkNodes,
  updateWorkRelatedByRelates,
  buildWorkRelatedBy
};
