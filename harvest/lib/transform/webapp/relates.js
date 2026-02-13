import cache from '../../cache.js';
import logger from '../../logger.js';
import {frame, simplifiedExpert} from './frame.js';
import {getGraphAsItems, getNodeByType, asArray, SHORT_TYPES} from '../utils.js';
import { getYearWeek } from '../../year-week.js';
import { Graph } from './graph.js';
import { Temporal } from '@js-temporal/polyfill';

const RELATES_PROPERTIES = [
  'http://vivoweb.org/ontology/core#relates',
  'ucdlib:relates-to',
  'relatesTo'
]

const RELATED_BY = 'http://vivoweb.org/ontology/core#relatedBy';

/**
 * @method getRelates
 * @description Given a subject, find all ae-std relationship nodes that relate to it 
 * and return them as a graph.  Only returns relationship nodes that directly relate to 
 * the given subject, other nodes in the rel files are ignored.
 * 
 * @param {String} subject uri
 * @param {Object} opts
 * @param {Temporal.PlainDate} opts.date the date to use for partitioning when finding related nodes (defaults to now)
 * @param {Boolean} opts.includeWork When finding relationships to a scholorly work, this lookup returns the work in every file
 *                                   since works are tied to users in ae-std.  This flag will return one full work graph.
 * @return {Graph} a graph containing the relationship nodes that relate to the given subject, with cleaned properties for webapp consumption 
 */
async function getRelates(subject, opts={}) {
  const partitionKeys = ['year-week-'+getYearWeek(opts.date), 'ae-std'];
  let graph = new Graph();
  const rdfResp = await cache.findRelatedExperts(subject, {partitionKeys});

  let workNode = null;
  let workRelatedBy = new Graph();

  for (const res of rdfResp.results) {
    const fp = res.filepath;
    if (!fp) continue;
    
    try {
      const rel = JSON.parse(await cache.read(fp));

      // if we want the scholary work fetch with the relationships.
      // This is very awkward due to ae-std works being tied to users.
      if( opts.includeWork ) {

        // its the first reference to the work, add all nodes
        if( !workNode ) {
          graph.addNodes(rel);
        }

        // get the full set of relationships for all work nodes
        let node = getNodeByType(rel, SHORT_TYPES.SCHOLARLY_WORK_TYPES, {match: true});

        // set the work node if first run through
        if( !workNode && node ) workNode = node;

        // construct the full relatedBy graph for the work
        workRelatedBy.addNodes(asArray(node[RELATED_BY]));
      }

      const items = getGraphAsItems(rel);

      for (let node of items) {
        node = _parseRelatesNode(subject, node);
        if( !node ) continue;       
        graph.addNode(node);
      }
    } catch (e) {
      logger.error(`Failed to read/parse RDF-found rel file ${fp}`, e);
    }
  }

  if( opts.includeWork ) {
    workNode[RELATED_BY] = Array.from(workRelatedBy.nodes.values());
  }

  return graph;
}

/**
 * @method _parseRelatesNode
 * @description Given a ae-std relationship node, ensure it relates to the given subject and 
 * extract the relevant relates information for webapp consumption.
 * 
 * @param {*} subject 
 * @param {*} node 
 * @returns 
 */
function _parseRelatesNode(subject, node) {
  if (!node || !node['@id']) return;

  const relatesArr = asArray(
    RELATES_PROPERTIES.map(prop => node[prop]).find(Boolean)
  );
  if (!relatesArr.length) {
    return;
  }

  // must reference the publication subject
  const referencesPub = relatesArr.some(r => {
    const rid = (typeof r === 'string') ? r : (r && r['@id'] ? r['@id'] : null);
    return rid && rid.split('#')[0] === subject;
  });
  if (!referencesPub) {
    logger.warn(`Relationship node ${node['@id']} does not reference the publication subject ${subject}`);
    return;
  }

  // clone node and set vivoweb relates to the collected relates
  const outNode = Object.assign({}, node);
  for(const prop of RELATES_PROPERTIES) {
    delete outNode[prop];
  }
  outNode['http://vivoweb.org/ontology/core#relates'] = relatesArr;
  
  return outNode;
}

export {
  getRelates
}