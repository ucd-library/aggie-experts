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

  // For grant graphs: drop #roleof_ nodes (non-AE person roles) when a proper
  // inheres_in-linked role of the same type already exists in the assembled graph.
  // This prevents duplicate contributors when an AE expert is also listed in the
  // grant's raw c-pi / c-co-pis fields under a slightly different name form.
  _dropRedundantRoleofNodes(graph);

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
 * @method _dropRedundantRoleofNodes
 * @description After assembling the merged grant graph, delete any #roleof_
 * node (marked with ae-roleof) whose role type is already covered by a proper
 * inheres_in-linked AE expert role node in the graph. Downstream framing
 * (jsonld.frame in webapp/frame.js) silently drops dangling @id references in
 * the grant's relatedBy array, so removing the node is sufficient to keep the
 * duplicate out of the indexed document — no flag is needed and no consumer
 * has to filter on one.
 *
 * @param {Graph} graph the assembled graph to mutate
 */
function _dropRedundantRoleofNodes(graph) {
  const AE_ROLEOF_FLAG = 'http://schema.library.ucdavis.edu/schema#ae-roleof';
  const INHERES_IN = 'http://purl.obolibrary.org/obo/RO_0000052';
  const NAME_PROP = 'http://schema.org/name';

  // Normalize a name into one or more comparable forms for matching. The
  // base form is "lastNormalized,firstWord" (lowercase, alpha-only), which
  // lets "Bishop, Matthew A" match "Bishop, Matthew". When the family
  // portion has multiple whitespace-separated tokens — e.g. one source
  // says "Leite Nobrega De Moura Bell, Juliana" while another says
  // "Bell, Juliana Leite Nobrega De Moura" — we ALSO emit a compound-name
  // variant that uses the last non-suffix family token as the "core"
  // surname. Common Anglophone name suffixes (jr/sr/ii/iii/iv) are
  // skipped when picking that core token so they don't become weak match
  // keys like "jr,john".
  const NAME_SUFFIX_RE = /^(jr|sr|ii|iii|iv)$/;
  function normalizeNameVariants(raw) {
    if (!raw) return [];
    // Strip a role prefix like "PI: " or "COPI: "
    let n = String(raw).replace(/^[^:]+:\s*/, '');
    // Remove anything in parentheses
    n = n.replace(/\(.*?\)/g, '');
    const parts = n.split(',');
    if (parts.length >= 2) {
      const lastRaw = parts[0].trim();
      const givenRaw = parts[1].trim();
      const last = lastRaw.toLowerCase().replace(/[^a-z]/g, '');
      // Take only the first word of the given-name portion to drop middle names/initials
      const given = (givenRaw.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
      if (!last && !given) return [];
      const variants = [`${last},${given}`];

      const lastTokens = lastRaw.split(/\s+/).filter(Boolean);
      if (lastTokens.length > 1) {
        // Walk backward to find the last non-suffix family token
        let coreLast = '';
        for (let i = lastTokens.length - 1; i >= 0; i--) {
          const t = lastTokens[i].toLowerCase().replace(/[^a-z]/g, '');
          if (!t || NAME_SUFFIX_RE.test(t)) continue;
          coreLast = t;
          break;
        }
        if (coreLast && coreLast !== last) {
          variants.push(`${coreLast},${given}`);
        }
      }
      return variants;
    }
    const fallback = n.toLowerCase().replace(/[^a-z,]/g, '');
    return fallback ? [fallback] : [];
  }

  function getNodeNameVariants(node) {
    const nameProp = node[NAME_PROP];
    if (!nameProp) return [];
    const items = Array.isArray(nameProp) ? nameProp : [nameProp];
    const out = [];
    items.forEach(v => {
      const raw = (typeof v === 'object' && v !== null) ? (v['@value'] || '') : String(v || '');
      normalizeNameVariants(raw).forEach(x => { if (x) out.push(x); });
    });
    return out;
  }

  // Build a set of (normalizedRoleType, normalizedName) pairs already covered
  // by proper inheres_in-linked AE expert role nodes. We add every variant
  // form a name produces so compound-name mismatches between the AE expert
  // record and the grant's raw c-pi/c-co-pis text still overlap.
  const coveredPairs = new Set();
  for (const node of graph.nodes.values()) {
    if (!node[INHERES_IN] || node[AE_ROLEOF_FLAG]) continue;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    const names = getNodeNameVariants(node);
    if (!names.length) continue;
    types.forEach(t => {
      if (!t) return;
      names.forEach(n => coveredPairs.add(`${t}|${n}`));
    });
  }

  if (coveredPairs.size === 0) return;

  // Drop a #roleof_ node when AT LEAST ONE of its role types is matched by an
  // AE expert with the same (type, normalized-name) pair. If Bishop is an AE
  // PI, drop his #roleof_ node even if that node also carries a CoPI type. A
  // #roleof_ node can have multiple names (one per role prefix); check all of
  // them, and check every compound-name variant of each.
  // We collect the redundant ids first and delete after the loop to avoid
  // mutating the Map while iterating it.
  const toDelete = [];
  for (const node of graph.nodes.values()) {
    if (!node[AE_ROLEOF_FLAG]) continue;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    const names = getNodeNameVariants(node);
    if (!names.length) continue;
    const anyCovered = types.some(t => t && names.some(n => coveredPairs.has(`${t}|${n}`)));
    if (anyCovered) {
      toDelete.push(node['@id']);
    }
  }
  if (toDelete.length === 0) return;

  // Remove the redundant role nodes from the graph itself.
  toDelete.forEach(id => graph.nodes.delete(id));

  // Then strip their @id references from every remaining node's relatedBy
  // array. Without this step, jsonld.frame in webapp/frame.js leaves dangling
  // `{@id: "..."}` stubs in place of each deleted role — those stubs are
  // indistinguishable from real role objects to the SPA's filter logic, which
  // ends up rendering them as nameless contributors that the UI fallback fills
  // in as "Lastname, Firstname".
  const RELATED_BY = 'http://vivoweb.org/ontology/core#relatedBy';
  const toDeleteSet = new Set(toDelete);
  for (const node of graph.nodes.values()) {
    if (!node[RELATED_BY]) continue;
    const refs = Array.isArray(node[RELATED_BY]) ? node[RELATED_BY] : [node[RELATED_BY]];
    const filtered = refs.filter(ref => {
      const refId = (typeof ref === 'string') ? ref : (ref && ref['@id']);
      return !toDeleteSet.has(refId);
    });
    if (filtered.length !== refs.length) {
      node[RELATED_BY] = filtered;
    }
  }
}

export {
  getRelates
}