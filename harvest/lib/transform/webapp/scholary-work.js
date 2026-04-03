import cache from '../../cache.js';
import { logger, config, getYearWeek } from '@ucd-lib/experts-commons';
import {frame, simplifiedExpert, flattenScholarlyWorksRelatedBy} from './frame.js';
import {getGraphAsItems, getNodeByType, asArray, SHORT_TYPES} from '../utils.js';
import { getRelates } from './relates.js';
import { Graph } from './graph.js';
import { embedWork, embedGrant } from '../../ai/embed.js';
import path from 'path';

const TYPES = [
  ...SHORT_TYPES.WORKS, ...SHORT_TYPES.GRANTS
]

const FOLDER_TYPES = {
  'grant': SHORT_TYPES.GRANTS,
  'work': SHORT_TYPES.WORKS
}

const PROMPT_ROOT_PROPS = [
  "@id",
  "@type",
  "DOI",
  "abstract",
  "author",
  "container-title",
  "is-visible",
  "issued",
  "page",
  "status",
  "title",
  "type",
  "volume",
  "assignedBy",
  "dateTimeInterval",
  "identifier",
  "modified-date",
  "sponsorAwardId",
  "status",
  "totalAwardAmount"
];

/**
 * @method generateBaseScholarlyWork
 * @description Given a scholarly work subject, transform the corresponding work into the framed and
 * compacted base scholarly work format used for the webapp.  This function returns a single node 
 * for the scholarly work.
 * 
 * @param {String} subject the subject URI of the work to transform
 * @param {Object} opts 
 * @param {Temporal.PlainDate} opts.date the date to use for partitioning when finding related nodes (defaults to now)
 * 
 * @return {Object} base scholarly work node
 */
async function generateBaseScholarlyWork(subject, opts={}) {
  let graph = await getRelates(subject, {date: opts.date, includeWork: true});
  if( graph.nodes.size === 0 ) {
    logger.warn(`No relationships found for scholarly work subject ${subject}`);
    return null;
  }

  graph = await frame(graph.toRdfGraph(), true);

  // hack.  the works get extra data at the moment, the relationships are transformed into the root
  if( graph['@graph'] ) {
    graph = getNodeByType(graph, TYPES, {match: true});
  }

  if( graph['@context'] ) {
    delete graph['@context'];
  }

  return graph;
}

/**
 * @method generateScholarlyWork
 * @description Given a scholarly work subject, transform the corresponding work into the framed and
 * compacted scholarly work format used for the webapp.  This function returns a single node 
 * for the scholarly work.
 * 
 * @param {String} subject the subject URI of the work to transform
 * @param {Object} opts 
 */
async function generateScholarlyWork(subject, opts={}) {
  logger.info(`Running AE webapp scholarly work transformation for subject: ${subject}`);
  
  let graph = new Graph();

  // get the base work node with all relationships added
  const baseWork = await generateBaseScholarlyWork(subject, opts);
  graph.addNode(baseWork);
  
  // get the experts related to the work and add to the graph
  const experts = await _getScholarlyWorkExperts(baseWork, opts);
  graph.addNodes(experts);

  let swType = getScholarlyWorkType(baseWork['@type']);
  if( !swType ) {
    throw new Error(`Failed to determine folder type for scholarly work ${baseWork['@id']} with types ${baseWork['@type']}`);
  }

  graph = graph.toRdfGraph();
  graph = promoteAttributesToRoot(baseWork, graph, swType);

  // Flatten all relatedBy.relates to arrays of strings to match ES schema
  flattenScholarlyWorksRelatedBy(graph);

  // Attach normalized embedding vector for KNN search
  try {
    const embedFn = swType === 'grant' ? embedGrant : embedWork;
    const embedResult = await embedFn(subject, { yearWeek: getYearWeek(), normalize: true, maxLength: config.llm.embedDimension });
    if (embedResult?.embedding) graph.embedding = embedResult.embedding;
  } catch(embedErr) {
    logger.warn(`Could not generate embedding for ${swType} ${subject}: ${embedErr.message}`);
  }

  let caskPath;
  if( opts.write ) {
    caskPath = await cache.writeScholarlyAsset(
      swType,
      path.join('ae-webapp', subject+'.json'),
      stringifyWithCompactEmbedding(graph)
    );
    caskPath = caskPath.assetPath;
  }

  return { filepath: caskPath, json: graph };
}

function getScholarlyWorkType(nodeTypes) {
  nodeTypes = asArray(nodeTypes);

  for( let folderType in FOLDER_TYPES ) {
    for( let type of FOLDER_TYPES[folderType] ) {
      for( let nodeType of nodeTypes ) {
        if( nodeType.includes(type) ) {
          return folderType;
        }
      }
    }
  }
}


async function _getScholarlyWorkExperts(baseWorkNode, opts={}) {
  let experts = new Set();

  // get all unique relatedBy.relates id's
  baseWorkNode?.relatedBy?.map(rel => rel.relates)
    .filter(rel => rel)
    .forEach(relates => {
      asArray(relates).forEach(item => {
        if( typeof item === 'object' && item['@id'] ) {
          experts.add(item['@id']);
        } else if (typeof item === 'string') {
          experts.add(item);
        }
      });
    });
  
  // filter to the experts id pattern
  experts = Array.from(experts).filter(id => id.startsWith('expert/'));

  const partitionKeys = ['year-week-'+getYearWeek(opts.date), 'ae-std'];
  const results = [];
  
  for( let expertId of experts ) {
    // first try the cache id map lookup
    let filepath = '';
    let cachedEmail = await cache.getUserIdLookup(expertId.split('/').pop());
    if( cachedEmail ) {
      filepath = cache.getUserPath(cachedEmail, 'ae-std/person.jsonld');
    // else use the RDF search to find the expert file based on expertId
    } else {
      logger.warn(`No cached email found for expertId ${expertId} in node.relatedBy.relates ${baseWorkNode['@id']}.  Attempting to find related expert via RDF search.`);
      expertId = 'http://experts.ucdavis.edu/'+expertId;

      let relatedExpert = await cache.findRelatedExperts(expertId, {partitionKeys});
      if( !relatedExpert.results.length ) {
        logger.warn(`Related expert not found for expertId ${expertId} in node.relatedBy.relates ${baseWorkNode['@id']}`);
        continue;
      }
      filepath = relatedExpert.results[0].filepath;

      // hack out their email from the filepath for the cache lookup since we don't have it
      cachedEmail = filepath.split('/').find(part => part.includes('@'));
    }

    if( !await cache.exists(filepath) ) {
      logger.warn(`Expert file not found in cache at ${filepath} for expertId ${expertId} in node.relatedBy.relates ${baseWorkNode['@id']}`);
      continue;
    }

    // check if expert is private
    let isPrivate = await cache.exists(cache.getUserPath(cachedEmail, 'PRIVATE'));
    if( isPrivate ) {
      logger.warn(`Expert ${expertId} in node.relatedBy.relates ${baseWorkNode['@id']} is marked private.  Skipping.`);
      continue;
    }

    let person = JSON.parse(await cache.read(filepath));
    person = await frame(person);
    person = getNodeByType(person, SHORT_TYPES.EXPERT, {match: true});

    if( !person ) {
      logger.warn(`Failed to frame expert node for expertId ${expertId} in node.relatedBy.relates ${baseWorkNode['@id']}`);
      continue;
    }

    results.push(simplifiedExpert(person));
  }

  return results;
}

/**
 * @function promoteAttributesToRoot
 * @description Promotes select attributes from the scholarly work node 
 * to the root graph of the elastic saerch document for easier webapp search. 
 * 
 * @param {Object} workNode the scholarly work node to promote attributes from
 * @param {Object} graph the full scholarly work graph to promote attributes to
 * @param {String} type generic work type (e.g. 'work' or 'grant') 
 * @returns 
 */
function promoteAttributesToRoot(workNode, graph, type) {
  let name;

  switch(type) {
    case 'work':
      name = generateWorkName(workNode);
      break;
    case 'grant':
      name = generateGrantName(workNode); 
      break;
    default:
      throw new Error(`Unknown type ${type} in promoteAttributesToRoot`);
  }

  // Works with a non-string title (e.g. an array) are misformatted source data.
  // Mark them hidden so they are excluded from search results and the public UI.
  const hasValidTitle = type !== 'work' || typeof workNode.title === 'string';
  if (!hasValidTitle) {
    logger.warn(`promoteAttributesToRoot: work ${workNode['@id']} has invalid title (${JSON.stringify(workNode.title)}) — marking is-visible=false`);
  }

  let root = {
    "@context": workNode["@context"],
    "@graph": getGraphAsItems(graph),
    "is-visible": hasValidTitle,
    "roles": ["public"],
    "name": name,
  };

  // promote select properties to the root (skip is-visible; we set it above based on title validity)
  PROMPT_ROOT_PROPS.forEach(prop => {
    if( prop === 'is-visible' ) return;
    if( workNode[prop] !== undefined ) {
      root[prop] = workNode[prop];
    }
  });

  return root;
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
 * @method generateWorkName
 * @description Generate a formatted work name string
 * @param {*} workNode the source work node
 * @returns {string} the formatted work name
 */
function generateWorkName(workNode) {
  // The ui is expecting a name in the format of "title § status • type • issued • author string § ...",
  // so default to truthy values for the joinValues below
  const title = workNode.title || ' ';
  const status = workNode.status || ' ';
  const type = workNode.type || ' ';
  const issued = workNode.issued || ' ';

  // only append values that exist
  function joinValues(values, joiner = ' ') {
    let arr = [];
    values.forEach(v => {
      if( v ) arr.push(v);
    });
    return arr.join(joiner);
  }

  function firstChar(str) {
    if( Array.isArray(str) ) {
      str = str[0];
    }
    return str ? str.charAt(0) : '';
  }

  // Extract author names for abbreviated format
  let authorString = '';
  let authorArr = asArray(workNode.author);

  if (authorArr.length > 0) {
    const firstAuthor = authorArr[0];
    const lastAuthor = authorArr[authorArr.length - 1];

    if( authorArr.length > 0 ) authorString = joinValues([firstAuthor.family, firstChar(firstAuthor.given)], ', ')+'.';
    if( authorArr.length > 1 ) authorString += ' & '+joinValues([lastAuthor.family, firstChar(lastAuthor.given)], ', ')+'.';
    if( authorArr.length > 2 ) authorString += ' et al.';
  }

  const containerTitle = workNode["container-title"] || '';
  const eissn = workNode.eissn || '';
  const doi = workNode.DOI || '';

  return joinValues([
    title,
    joinValues([status, type, issued, authorString], ' • '),
    joinValues([containerTitle, eissn], ' • '),
    doi
  ], ' § ');
}


/**
 * @function stringifyWithCompactEmbedding
 * @description Pretty-print a JSON object with indentation, but collapse the
 * top-level `embedding` array to a single line by pre-stringifying it so it
 * appears as a compact JSON string value rather than an expanded array.
 * Callers reading the file back must JSON.parse the embedding field.
 * @param {Object} obj - object to serialize
 * @returns {String} formatted JSON string
 */
function stringifyWithCompactEmbedding(obj) {
  if (!obj.embedding) return JSON.stringify(obj, null, 2);
  return JSON.stringify({ ...obj, embedding: JSON.stringify(obj.embedding) }, null, 2);
}

export {
  generateBaseScholarlyWork,
  generateScholarlyWork,
  getScholarlyWorkType
};