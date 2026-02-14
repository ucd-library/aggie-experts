import cache from '../../cache.js';
import logger from '../../logger.js';
import {frame, simplifiedExpert} from './frame.js';
import {getGraphAsItems, getNodeByType, asArray, SHORT_TYPES} from '../utils.js';
import { getYearWeek } from '../../year-week.js';
import { getRelates } from './relates.js';
import { Graph } from './graph.js';
import path from 'path';

const TYPES = [
  ...SHORT_TYPES.WORKS, ...SHORT_TYPES.GRANTS
]

const FOLDER_TYPES = {
  'grant': SHORT_TYPES.GRANTS,
  'work': SHORT_TYPES.WORKS
}

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

  graph = graph.toRdfGraph();
  graph = promoteAttributesToRoot(baseWork, graph);

  if( opts.write ) {
    // we need to get the 'simiplifed' types for folder name
    let folderType = getScholarlyWorkType(baseWork['@type']);

    if( !folderType ) {
      throw new Error(`Failed to determine folder type for scholarly work ${baseWork['@id']} with types ${baseWork['@type']}`);
    }
    let filename = subject.split(/[\/|#]/).pop();

    await cache.writeScholarlyAsset(
      'ae-webapp-expert-transform',
      folderType,
      path.join('ae-webapp', filename+'.json'),
      JSON.stringify(graph, null, 2)
    );
  }

  return graph;
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
    expertId = 'http://experts.ucdavis.edu/'+expertId;

    let relatedExpert = await cache.findRelatedExperts(expertId, {partitionKeys});
    if( !relatedExpert.results.length ) {
      logger.warn(`Related expert not found for expertId ${expertId} in node.relatedBy.relates ${baseWorkNode['@id']}`);
      return null;
    }

    let person = JSON.parse(await cache.read(relatedExpert.results[0].filepath));

    person = await frame(person);

    person = getNodeByType(person, SHORT_TYPES.EXPERT, {match: true});

    results.push(simplifiedExpert(person));
  }

  return results;
}

function promoteAttributesToRoot(workNode, graph) {
  return {
    "@context": framedDocument["@context"],
    "@graph": graph,
    // Root-level properties (same as work node)
    "@id": workNode["@id"],
    "@type": workNode["@type"],
    "DOI": workNode.DOI,
    // "_id": workNode["@id"],  // removed to match old output
    "abstract": workNode.abstract,
    "author": workNode.author,
    "container-title": workNode["container-title"],
    "is-visible": true,
    "issued": workNode.issued,
    // "modified-date": workNode["modified-date"] || new Date().toISOString(), // removed to match old output
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
  let authorArr = asArray(workNode.author);
  if (authorArr.length > 0) {
    const firstAuthor = authorArr[0];
    const lastAuthor = authorArr[authorArr.length - 1];

    if (authorArr.length === 1) {
      authorString = `${firstAuthor.family}, ${firstAuthor.given?.charAt(0) || ''}`;
    } else if (authorArr.length === 2) {
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


export {
  generateBaseScholarlyWork,
  generateScholarlyWork,
  getScholarlyWorkType
};