import cache from '../../cache.js';
import { logger, config } from '@ucd-lib/experts-commons';
import { Graph } from './graph.js';
import {frame, simplifiedExpert, flattenScholarlyWorksRelatedBy} from './frame.js';
import { addSearchFieldsToGraph } from './search-fields.js';
import {asArray, getNodeByType, SHORT_TYPES} from '../utils.js';
import { generateBaseScholarlyWork } from './scholary-work.js';
import { computeExpertCentroid, postProcessVector } from '../../ai/embed.js';
import { buildExpertSearchDoc } from './search-doc.js';

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

  let aeStdPersonPath = cache.getUserPath(username, 'ae-std/person.jsonld');
  if( !await cache.exists(aeStdPersonPath) ) {
    logger.warn(`No ae-std person.jsonld found for user ${username} at path ${aeStdPersonPath}`);
    return null;
  }

  // Read the main expert graph
  const aeStdPerson = await cache.readUserAsset(username, 'ae-std/person.jsonld');
  
  const expertGraph = JSON.parse(aeStdPerson);

  // const keycloak = await cache.readUserAsset(username, 'keycloak.json');
  // const expertId = JSON.parse(keycloak).attributes.expertId[0];


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

  // Flatten all relatedBy.relates fields to arrays of strings (not objects)
  // This must happen after graph assembly since generateBaseScholarlyWork does
  // not call flattenScholarlyWorksRelatedBy on individual extracted nodes.
  flattenScholarlyWorksRelatedBy(graph);

  // Add denormalized combined search fields used by the imperative search implementation
  addSearchFieldsToGraph(graph);

  // Compute centroid embedding across all works/grants now that their embeddings are cached.
  // NOTE: computeExpertCentroid reads cached embeddings from cask — it does not call the LLM.
  // Work/grant embeddings must already exist (written by generateScholarlyWork) before this runs.
  try {
    const centroid = await computeExpertCentroid(workUris);
    if (centroid) graph.embedding = centroid;
  } catch(embedErr) {
    logger.warn(`Could not compute centroid embedding for expert ${username}: ${embedErr.message}`);
  }

  // Attach individual embeddings to each work/grant @graph node so that nested KNN
  // can match specific works/grants within an expert document and report counts.
  // The cache stores the raw full-dimensional vector; we apply the same clip+normalize
  // used for root-level embeddings before attaching to the nested node.
  for (const workUri of workUris) {
    const embedPath = `/embed/${workUri}/embed.json`;
    try {
      if (!await cache.exists(embedPath)) continue;
      const data = JSON.parse(await cache.read(embedPath));
      if (!data?.embedding?.length) continue;
      const embedding = postProcessVector(data.embedding, { normalize: true, maxLength: config.llm.embedDimension });
      const node = graph['@graph'].find(n => n['@id'] === workUri);
      if (node) node.embedding = embedding;
    } catch(embedErr) {
      logger.warn(`Could not attach embedding for ${workUri} in expert ${username}: ${embedErr.message}`);
    }
  }

  if( opts.write ) {
    const json = graph.embedding
      ? JSON.stringify({ ...graph, embedding: JSON.stringify(graph.embedding) }, null, 2)
      : JSON.stringify(graph, null, 2);
    await cache.writeUserAsset(
      username,
      'webapp/expert.jsonld',
      json
    );

    // Write flat search doc for the ae-search index
    try {
      const searchDoc = buildExpertSearchDoc(graph, expertNode);
      const searchJson = searchDoc.embedding
        ? JSON.stringify({ ...searchDoc, embedding: JSON.stringify(searchDoc.embedding) }, null, 2)
        : JSON.stringify(searchDoc, null, 2);
      await cache.writeUserAsset(username, 'webapp/expert.search.jsonld', searchJson);
    } catch(searchDocErr) {
      logger.warn(`Could not write expert search doc for ${username}: ${searchDocErr.message}`);
    }
  }


  return graph;
}

/**
 * @method promoteExpertInfoToWorkRoot
 * @description For a given work node, promotes relevant expert information from the expert node to the root of the work node.
 */
function promoteExpertInfoToWorkRoot(workNode, expertNode) {
  if( expertNode.hasName && !workNode.hasName ) {
    workNode.hasName = expertNode.hasName;
  }
  // TODO: was there a method for picking which contact info node to promote?
  if( expertNode.contactInfo?.length && !workNode.contactInfo ) {
    workNode.contactInfo = expertNode.contactInfo[0];
  }
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