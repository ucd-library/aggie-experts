import fs from 'fs-extra';
import path from 'path';
import jsonld from 'jsonld';
import logger from '../../logger.js';
import config from '../../config.js';
import cache from '../../cache.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const contextPath = path.join(__dirname, 'schema', '4', 'context.jsonld');
const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
const framePath = path.join(__dirname, 'frames', 'default.json');
const frameFile = JSON.parse(fs.readFileSync(framePath, 'utf8'));

async function frame(expertId, graph, expertGraph = null) {
  let item = {
    "@id": "info:fedora" + expertId,
    "@version": 1.1,
    "@graph": graph
  };

  let frame = {
    ...frameFile,
    ...context
  };

  let framed = await jsonld.frame(item, frame, {omitGraph: false});

  // Order authors by rank
  if (!Array.isArray(framed["@graph"])) {
    framed["@graph"] = [framed["@graph"]];
  }

  framed["@graph"]?.forEach((node) => {
    if (node?.["author"]) {
      if (!Array.isArray(node["author"])) {
        node["author"] = [node["author"]];
      } else {
        node["author"].sort((a, b) => a["rank"] - b["rank"]);
      }
    }
  });

  // REORDER: Put expert first, then works/grants
  if (framed["@graph"] && Array.isArray(framed["@graph"])) {
    const expertNodes = [];
    const workNodes = [];
    const grantNodes = [];
    const otherNodes = [];

    framed["@graph"].forEach(node => {
      if (!node || !node['@type']) {
        otherNodes.push(node);
        return;
      }

      const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];

      const isExpert = types.some(type =>
        type.includes('Expert') ||
        type.includes('Person') ||
        type.includes('Agent')
      );

      const isWork = types.some(type =>
        type.includes('Work') ||
        type.includes('ScholarlyArticle') ||
        type.includes('Article') ||
        type.includes('Publication')
      );

      const isGrant = types.some(type =>
        type.includes('Grant')
      );

      if (isExpert) {
        expertNodes.push(node);
      } else if (isWork) {
        workNodes.push(node);
      } else if (isGrant) {
        grantNodes.push(node);
      } else {
        otherNodes.push(node);
      }
    });

    // Reorder: Expert first, then works, then grants, then others
    framed["@graph"] = [...expertNodes, ...workNodes, ...grantNodes, ...otherNodes];
  }

  framed["@id"] = expertId;
  framed["@context"] = (config?.server?.url || 'https://experts.ucdavis.edu') + "/api/schema/context.jsonld";
  return framed;
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

    const files = fs.readdirSync(relCachePath).filter(file => file.endsWith('.jsonld'));
    logger.info(`Found ${files.length} relationship files`);

    for (const file of files) {
      try {
        const filePath = path.join(relCachePath, file);
        const relationshipData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        let graphItems = [];
        if (Array.isArray(relationshipData)) {
          graphItems = relationshipData;
        } else if (relationshipData['@graph'] && Array.isArray(relationshipData['@graph'])) {
          graphItems = relationshipData['@graph'];
        } else {
          graphItems = [relationshipData];
        }

        // Separate publications/grants from relationships
        const publications = [];
        const grants = [];
        const relationships = [];

        graphItems.forEach(item => {
          if (!item || !item['@type']) return;

          const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
          // console.log('types', JSON.stringify(types));

          const isPublication = types.some(type =>
            type.includes('Work') ||
            type.includes('ScholarlyArticle') ||
            type.includes('Article') ||
            type.includes('Publication')
          );

          const isGrant = types.some(type =>
            type.includes('Grant') ||
            type.includes('Grant_Service')
          );

          const isRelationship = types.some(type =>
            type.includes('ucdlib:Authorship') ||
            type.includes('Authorship') ||
            type.includes('ResearcherRole') ||
            type.includes('GrantRole')
          );

          if (isPublication) {
            publications.push(item);
          } else if (isGrant) {
            grants.push(item);
          } else if (isRelationship) {
            relationships.push(item);
          }
        });

        // Merge relationships into publications/grants
        const mergedItems = [];

        // Process publications
        publications.forEach(publication => {
          const mergedPublication = { ...publication };

          // Find relationships that relate to this publication
          const relatedRelationships = relationships.filter(rel => {
            // Check if relationship relates to this publication
            const relatesTo = rel['ucdlib:relates-to'] || rel['relatesTo'];
            if (!relatesTo) return false;

            const relatesToId = Array.isArray(relatesTo) ? relatesTo[0]['@id'] : relatesTo['@id'];
            return relatesToId === publication['@id'];
          });

          // Add relationships to the publication's relatedBy property
          if (relatedRelationships.length > 0) {
            if (!mergedPublication.relatedBy) {
              mergedPublication.relatedBy = [];
            } else if (!Array.isArray(mergedPublication.relatedBy)) {
              mergedPublication.relatedBy = [mergedPublication.relatedBy];
            }

            // Add the relationship data
            mergedPublication.relatedBy = [...mergedPublication.relatedBy, ...relatedRelationships];
          }

          mergedItems.push(mergedPublication);
        });

        // Process grants similarly
        grants.forEach(grant => {
          const mergedGrant = { ...grant };

          const relatedRelationships = relationships.filter(rel => {
            const relatesTo = rel['ucdlib:relates-to'] || rel['relatesTo'];
            if (!relatesTo) return false;

            const relatesToId = Array.isArray(relatesTo) ? relatesTo[0]['@id'] : relatesTo['@id'];
            return relatesToId === grant['@id'];
          });

          if (relatedRelationships.length > 0) {
            if (!mergedGrant.relatedBy) {
              mergedGrant.relatedBy = [];
            } else if (!Array.isArray(mergedGrant.relatedBy)) {
              mergedGrant.relatedBy = [mergedGrant.relatedBy];
            }

            mergedGrant.relatedBy = [...mergedGrant.relatedBy, ...relatedRelationships];
          }

          mergedItems.push(mergedGrant);
        });

        combinedGraph = [...combinedGraph, ...mergedItems];

        logger.info(`Merged ${file}: ${publications.length} publications + ${grants.length} grants with ${relationships.length} relationships = ${mergedItems.length} final items`);

      } catch (error) {
        logger.error(`Error reading relationship file ${file}:`, error);
      }
    }

    logger.info(`Combined graph contains ${combinedGraph.length} merged items`);

  } catch (error) {
    logger.error(`Error reading relationship directory:`, error);
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

  return cache.writeUserAsset(
    'ae-webapp-transform',
    cacheUsername,
    path.join(config.cache.aeWebappDir, 'webapp.jsonld'),
    framed
  );
}

export {
  runFromFiles,
  frame,
  readRelationshipFiles
};
