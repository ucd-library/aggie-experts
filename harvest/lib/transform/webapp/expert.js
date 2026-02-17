import cache from '../../cache.js';
import logger from '../../logger.js';
import config from '../../config.js';
import { Graph } from './graph.js';
import {frame, simplifiedExpert} from './frame.js';
import {asArray, getNodeByType, SHORT_TYPES} from '../utils.js';
import { generateBaseScholarlyWork } from './scholary-work.js';

/**
 * @method generateBaseExpert
 * @description Generates the based compacted expert data for the webapp transformation.
 * 
 * @param {String} username the username (email) of the expert to generate the data for
 * 
 * @returns {Object} the framed expert data ready for webapp consumption
*/
async function generateBaseExpert(username, opts={}) {
  logger.info(`Running AE webapp base expert transformation for user: ${username}`);

  // Read the main expert graph
  const aeStdPerson = await cache.readUserAsset(username, 'ae-std/person.jsonld');
  
  const expertGraph = JSON.parse(aeStdPerson);

  const keycloak = await cache.readUserAsset(username, 'keycloak.json');
  const expertId = JSON.parse(keycloak).attributes.expertId[0];


  // TODO should we do extra cleanup before framing?
  // like the promoteAttributes to root
  // or for works/grants, the updateRelatedBy stuff  

  // Frame the expert graph to webapp format
  const framed = await frame(expertGraph);
  const node = getNodeByType(framed, SHORT_TYPES.EXPERT, {match: true});

  if( !node ) {
    logger.error(`No expert node found for user ${username} in framed graph`);
    return null;
  }

  if( opts.write ) {
    await cache.writeUserAsset(
      'ae-webapp-expert-transform',
      username,
      'webapp/expert-base.jsonld',
      JSON.stringify(node, null, 2)
    );
  }

  return node;
}

async function generateSimplifiedExpert(username, opts={}) {
  logger.info(`Running AE webapp simplified expert transformation for user: ${username}`);

  let expertNode;

  if( opts.fresh ) {
    // Frame the expert graph to webapp format
    expertNode = await generateBaseExpert(username, {write: false});
  } else {
    // If not fresh, we can attempt to read the already framed expert data (faster)
    expertNode = JSON.parse(await cache.readUserAsset(username, 'webapp/expert-base.jsonld'));
  }

  let simplified = simplifiedExpert(expertNode);

  if( opts.write ) {
    await cache.writeUserAsset(
      'ae-webapp-expert-transform',
      username,
      'webapp/expert-simplified.jsonld',
      JSON.stringify(simplified, null, 2)
    );
  }

  return simplified;
}

async function generateExpert(username, opts={}) {
  logger.info(`Running AE webapp expert transformation for user: ${username}`);

  let graph = new Graph();

  let expertNode;
  if( opts.fresh ) {
    // Frame the expert graph to webapp format
    expertNode = await generateBaseExpert(username, {write: false});
  } else {
    // If not fresh, we can attempt to read the already framed expert data (faster)
    expertNode = JSON.parse(await cache.readUserAsset(username, 'webapp/expert-base.jsonld'));
  }
  graph.addNode(expertNode);
  
  // get list of all relationstips from ae-std cask data
  let files = await cache.getExpertAeStdRelations(username, {date: opts.date});
  let workUris = new Set();

  for( let file of files ) {
    let work = JSON.parse(await cache.read(file));
    let workNode = getNodeByType(work, SHORT_TYPES.SCHOLARLY_WORK_TYPES, {match: true});
    if( workNode ) {
      workUris.add(workNode['@id']);
    }
  }

  workUris = Array.from(workUris);

  for( let workUri of workUris ) {
    let workNode = await generateBaseScholarlyWork(workUri, {date: opts.date});
    graph.addNode(workNode);
  }
  
  graph = graph.toRdfGraph();
  graph = promoteAttributesToRoot(expertNode, graph['@graph']);

  if( opts.write ) {
    await cache.writeUserAsset(
      'ae-webapp-expert-transform',
      username,
      'webapp/expert.jsonld',
      JSON.stringify(graph, null, 2)
    );
  }


  return graph;
}

/**
 * @method promoteAttributesToRoot
 * @description Promotes hasAvailability, type, contactInfo, is-visible and name
 * from the expert node to the root of the document.
 * This is pulled from the fin model in AEv2.
 * 
 * @param {Object} expertNode the expert node to promote attributes from
 * @param {Object} graph the graph to promote attributes to
 * 
 * @returns {*} the restructured document
 */
function promoteAttributesToRoot(expertNode, graph) {
  // hummm
  // if( typeof compacted["is-visible"] === 'object' ) delete compacted["is-visible"];


  const doc = {
    "@id": expertNode['@id'],
    "@context": (config?.server?.url || 'https://stage.experts.library.ucdavis.edu') + "/api/schema/context.jsonld",
    "@graph": graph,
    "@type": "Expert"
  };

  // if( typeof expertNode["is-visible"] === 'object' ) delete expertNode["is-visible"];

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
    let contactInfos = asArray(expertNode["contactInfo"]);
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

  return doc;
}

export {
  generateExpert,
  generateBaseExpert,
  generateSimplifiedExpert
}