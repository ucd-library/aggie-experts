import cache from '../../cache.js';
import { logger } from '@ucd-lib/experts-commons';
import {frame, simplifiedExpert} from './frame.js';
import {getGraphAsItems, getNodeByType, asArray, SHORT_TYPES} from '../utils.js';
import { getYearWeek } from '@ucd-lib/experts-commons';
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
  rdfResp.results.sort((a, b) => b.modified.getTime() - a.modified.getTime());

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

  // For grant graphs: suppress #roleof_ nodes (non-AE person roles) when a proper
  // inheres_in-linked role of the same type already exists in the assembled graph.
  // This prevents duplicate contributors when an AE expert is also listed in the
  // grant's raw c-pi / c-co-pis fields under a slightly different name form.
  _suppressRedundantRoleofNodes(graph);

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

/**
 * @method _suppressRedundantRoleofNodes
 * @description After assembling the merged grant graph, flag any #roleof_ node
 * (marked with ae-roleof) whose role type is already covered by a proper
 * inheres_in-linked role node in the graph. The flag allows the webapp to skip
 * rendering the duplicate without removing the node from the graph (which may
 * be needed for other purposes, e.g. works author linking).
 *
 * @param {Graph} graph the assembled graph to mutate
 */
function _suppressRedundantRoleofNodes(graph) {
  const AE_ROLEOF_FLAG = 'http://schema.library.ucdavis.edu/schema#ae-roleof';
  const AE_ROLEOF_SUPPRESS = 'http://schema.library.ucdavis.edu/schema#ae-roleof-suppress';
  const INHERES_IN = 'http://purl.obolibrary.org/obo/RO_0000052';
  const NAME_PROP = 'http://schema.org/name';

  // Normalize a name for comparison: lowercase, remove middle initials/names,
  // remove punctuation, collapse whitespace.  This lets "Bishop, Matthew A"
  // match "Bishop, Matthew" and vice-versa.
  function normalizeName(raw) {
    if (!raw) return '';
    // Strip a role prefix like "PI: " or "COPI: "
    let n = String(raw).replace(/^[^:]+:\s*/, '');
    // Remove anything in parentheses
    n = n.replace(/\(.*?\)/g, '');
    // Split on comma: "Last, First Middle" → keep Last + First word only
    const parts = n.split(',');
    if (parts.length >= 2) {
      const last = parts[0].trim().toLowerCase().replace(/[^a-z]/g, '');
      // Take only the first word of the given-name portion to drop middle names/initials
      const given = (parts[1].trim().split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
      return `${last},${given}`;
    }
    return n.toLowerCase().replace(/[^a-z,]/g, '');
  }

  function getNodeName(node) {
    const nameProp = node[NAME_PROP];
    if (!nameProp) return '';
    const first = Array.isArray(nameProp) ? nameProp[0] : nameProp;
    const raw = (typeof first === 'object' && first !== null) ? (first['@value'] || '') : String(first || '');
    return normalizeName(raw);
  }

  // Returns all normalized names from a node (for #roleof_ nodes that may have multiple)
  function getNodeNames(node) {
    const nameProp = node[NAME_PROP];
    if (!nameProp) return [];
    const items = Array.isArray(nameProp) ? nameProp : [nameProp];
    return items
      .map(v => (typeof v === 'object' && v !== null) ? (v['@value'] || '') : String(v || ''))
      .map(normalizeName)
      .filter(Boolean);
  }

  // Build a set of (normalizedRoleType, normalizedName) pairs already covered
  // by proper inheres_in-linked AE expert role nodes.
  const coveredPairs = new Set();
  for (const node of graph.nodes.values()) {
    if (!node[INHERES_IN] || node[AE_ROLEOF_FLAG]) continue;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    const name = getNodeName(node);
    if (!name) continue;
    types.forEach(t => t && coveredPairs.add(`${t}|${name}`));
  }

  if (coveredPairs.size === 0) return;

  // Flag a #roleof_ node only when AT LEAST ONE of its role types is matched
  // by an AE expert with the same (type, normalized-name) pair. If Bishop is an
  // AE PI, suppress his #roleof_ node even if that node also carries a CoPI type.
  // A #roleof_ node can have multiple names (one per role prefix); check all of them.
  for (const node of graph.nodes.values()) {
    if (!node[AE_ROLEOF_FLAG]) continue;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    const names = getNodeNames(node);
    if (!names.length) continue;
    // Suppress when any (type, name) combination is already covered by an AE expert
    const anyCovered = types.some(t => t && names.some(n => coveredPairs.has(`${t}|${n}`)));
    if (anyCovered) {
      node[AE_ROLEOF_SUPPRESS] = true;
    }
  }
}

export {
  getRelates
}