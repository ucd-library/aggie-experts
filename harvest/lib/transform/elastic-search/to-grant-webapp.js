import path from 'path';
import logger from '../../logger.js';
import config from '../../config.js';
import cache from '../../cache.js';
import {sortJsonRecursively} from '../utils.js';
import { getExpertNode, createSimplifiedExpert } from './to-person-webapp.js';

/**
 * @method generateGrantFiles
 * @description Generate individual grant files for Elasticsearch
 * @param {*} cacheUsername the cache username
 * @param {*} expertId the expert identifier
 * @param {*} framedDocument the framed document to transform
 * @param {*} utils functions used for transformations
 * @returns {*} array of generated grant file paths
 */
async function generateGrantFiles(cacheUsername, expertId, framedDocument, utils = {}) {
  const { collapseSingleItemPrimitiveArrays } = utils;
  const grantFiles = [];

  // Extract grant nodes from the framed document
  const grantNodes = framedDocument["@graph"].filter(node => {
    if (!node || !node['@type']) return false;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    return types.some(t => t.includes('Grant'));
  });

  // Get the expert node for reference
  const expertNode = getExpertNode(framedDocument);
  if (!expertNode) {
    logger.warn('No expert node found in framed document');
    return grantFiles;
  }

  // Create a simplified expert node for inclusion in grant files
  const simplifiedExpert = createSimplifiedExpert(expertNode);
  if (!simplifiedExpert) {
    logger.warn('Could not create simplified expert node');
    return grantFiles;
  }

  for (const grantNode of grantNodes) {
    try {
      // Extract the grant ID for filename
      const grantId = grantNode["@id"];
      const fileId = extractGrantFileId(grantId);

      // Create the grant document structure
      const grantDocument = createGrantDocument(grantNode, simplifiedExpert, framedDocument);

      // Sort the document
      const sortedDocument = sortJsonRecursively(grantDocument);

      // Convert to formatted JSON
      let outputText = JSON.stringify(sortedDocument, null, 2);
      if (collapseSingleItemPrimitiveArrays) {
        outputText = collapseSingleItemPrimitiveArrays(outputText);
      }

      // Write the grant file
      const filename = `webapp.grant.${fileId}.jsonld`;
      const filePath = path.join(config.cache.aeWebappDir, filename);

      await cache.writeUserAsset(
        'ae-webapp-grant-transform',
        cacheUsername,
        filePath,
        outputText
      );

      grantFiles.push(filePath);
      logger.info(`Generated grant file: ${filename}`);

    } catch (error) {
      logger.error(`Error generating grant file for ${grantNode["@id"]}: ${error.message}`);
    }
  }

  return grantFiles;
}

/**
 * @method extractGrantFileId
 * @description Extract grant file ID from grant ark identifier
 * @param {string} grantId the full grant identifier
 * @returns {string} the extracted grant file ID
 */
function extractGrantFileId(grantId) {
  // Handle different grant ID formats
  if (grantId.includes('/grant/')) {
    return grantId.split('/grant/')[1];
  }
  // Fallback for other formats
  return grantId.replace(/^ark:\/87287\/[^\/]+\//, '').replace(/\//g, '-');
}

/**
 * @method createGrantDocument
 * @description Create a grant document structure for Elasticsearch
 * @param {*} grantNode the source grant node
 * @param {*} simplifiedExpert the simplified expert node to include
 * @param {*} framedDocument the full framed document for context
 * @returns {*} the grant document structure
 */
function createGrantDocument(grantNode, simplifiedExpert, framedDocument) {
  return {
    "@context": framedDocument["@context"],
    "@graph": [
      // Include the grant node with all its data
      {
        ...grantNode,
        "is-visible": true // Ensure visibility
      },
      // Include simplified expert node
      simplifiedExpert
    ],
    // Root-level properties (same as grant node)
    "@id": grantNode["@id"],
    "@type": grantNode["@type"],
    "_id": grantNode["@id"],
    "assignedBy": grantNode.assignedBy,
    "dateTimeInterval": grantNode.dateTimeInterval,
    "identifier": grantNode.identifier,
    "is-visible": true,
    "modified-date": grantNode["modified-date"] || new Date().toISOString(),
    "name": generateGrantName(grantNode),
    "relatedBy": grantNode.relatedBy,
    "roles": ["public"],
    "sponsorAwardId": grantNode.sponsorAwardId,
    "status": grantNode.status,
    "totalAwardAmount": grantNode.totalAwardAmount
  };
}

/**
 * @method generateGrantName
 * @description Generate grant name if missing
 * @param {*} grantNode the source grant node
 * @returns {string} the generated grant name
 */
function generateGrantName(grantNode) {
  // Use existing name if available, or construct one
  if (grantNode.name) {
    return grantNode.name;
  }

  const title = grantNode.title || '';
  const status = grantNode.status || '';
  const assignedBy = grantNode.assignedBy?.name || '';
  const sponsorAwardId = grantNode.sponsorAwardId || '';

  // Extract date range from dateTimeInterval
  let dateRange = '';
  if (grantNode.dateTimeInterval) {
    const start = grantNode.dateTimeInterval.start?.dateTime;
    const end = grantNode.dateTimeInterval.end?.dateTime;
    if (start && end) {
      const startYear = new Date(start).getFullYear();
      const endYear = new Date(end).getFullYear();
      dateRange = `${startYear} - ${endYear}`;
    }
  }

  // Extract PI name from relatedBy roles
  let piName = '';
  if (grantNode.relatedBy && Array.isArray(grantNode.relatedBy)) {
    const piRole = grantNode.relatedBy.find(role => {
      const types = Array.isArray(role['@type']) ? role['@type'] : [role['@type']];
      return types.some(t => t.includes('PrincipalInvestigatorRole'));
    });
    if (piRole && piRole.relates) {
      const piPerson = Array.isArray(piRole.relates)
        ? piRole.relates.find(r => r.name || r.hasName)
        : piRole.relates;
      if (piPerson) {
        piName = piPerson.name || (piPerson.hasName ? `${piPerson.hasName.family}, ${piPerson.hasName.given}` : '');
      }
    }
  }

  return `${title} § ${status} • ${dateRange} • ${piName} § ${assignedBy} • ${sponsorAwardId}`;
}

/**
 * @method getGrantNodes
 * @description Extract grant nodes from a graph
 * @param {*} framedDocument the framed document to extract from
 * @returns {*} array of grant nodes
 */
function getGrantNodes(framedDocument) {
  return framedDocument["@graph"].filter(node => {
    if (!node || !node['@type']) return false;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    return types.some(t => t.includes('Grant'));
  });
}

/**
 * @method updateGrantRelatedByRelates
 * @description Update relatedBy relates fields in grant nodes to use simplified expert references
 * @param {*} compacted the compacted document containing grants and expert
 */
function updateGrantRelatedByRelates(compacted) {
  const expertNode = compacted["@graph"].find(
    n => n && (n["@type"] === "Expert" || (Array.isArray(n["@type"]) && n["@type"].includes("Expert")))
  );
  if (!expertNode) return;

  const expertIdStr = expertNode['@id'];
  const expertLabel = expertNode.label || expertNode.name;

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

export {
  generateGrantFiles,
  createGrantDocument,
  generateGrantName,
  getGrantNodes,
  extractGrantFileId,
  updateGrantRelatedByRelates
};
