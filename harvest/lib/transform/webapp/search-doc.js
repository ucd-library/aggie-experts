/**
 * @module search-doc
 * @description Builds flat search documents for the ae-search Elasticsearch index.
 * These documents are stripped of linked-data structure — they contain only the fields
 * needed for KNN + BM25 search and routing mget requests back to the full-document
 * indices (experts, works, grants).
 *
 * Expert search docs carry a centroid embedding computed from all of the expert's works/grants.
 * Work and grant search docs carry their own embedding plus an expert_ids array so that
 * per-expert match counts can be computed with a single aggregation query.
 */

import { asArray } from '../utils.js';

const SEARCH_FIELDS = ['search_name', 'search_title', 'search_identifiers', 'search_description'];
const WORK_ROOT_PROPS = ['title', 'abstract', 'issued', 'type', 'DOI', 'identifier', 'modified-date'];
const GRANT_ROOT_PROPS = ['title', 'abstract', 'status', 'type', 'dateTimeInterval', 'sponsorAwardId', 'modified-date'];

/**
 * @function extractExpertIds
 * @description Extract expert IDs from a scholarly work node's relatedBy.relates array.
 * Handles both pre- and post-flatten forms (objects with @id or plain strings).
 * @param {Object} workNode framed base work or grant node
 * @returns {Array<string>} array of expert IDs in expert/{id} form
 */
function extractExpertIds(workNode) {
  const experts = new Set();
  const relatedBy = asArray(workNode?.relatedBy);

  for (const rel of relatedBy) {
    const relates = asArray(rel?.relates);
    for (const item of relates) {
      const id = typeof item === 'string' ? item : item?.['@id'];
      if (id && id.startsWith('expert/')) experts.add(id);
    }
  }

  return Array.from(experts);
}

/**
 * @function buildExpertSearchDoc
 * @description Build a flat search document for an expert from the fully assembled
 * expert graph (post-promoteAttributesToRoot, post-addSearchFieldsToGraph).
 * The root-level embedding field is the centroid computed across all of the expert's works.
 *
 * @param {Object} graph assembled expert document (return of promoteAttributesToRoot)
 * @param {Object} expertNode original framed expert node (pre-graph-assembly); used for overview
 * @returns {Object} flat search document ready for ae-search indexing
 */
function buildExpertSearchDoc(graph, expertNode) {
  const doc = {
    '@id': graph['@id'],
    '@type': 'expert',
    'is-visible': graph['is-visible'] ?? false,
  };

  if (graph.name) doc.name = graph.name;
  if (graph['modified-date']) doc['modified-date'] = graph['modified-date'];
  if (graph.hasAvailability) doc.hasAvailability = graph.hasAvailability;
  if (expertNode?.overview) doc.overview = expertNode.overview;
  if (graph.embedding) doc.embedding = graph.embedding;

  // Search fields live on the expert node within @graph (added by addSearchFieldsToGraph)
  const expertGraphNode = (graph['@graph'] || []).find(n => {
    const types = asArray(n['@type']);
    return types.some(t => t && t.includes('Expert'));
  });

  if (expertGraphNode) {
    for (const f of SEARCH_FIELDS) {
      if (expertGraphNode[f] !== undefined) doc[f] = expertGraphNode[f];
    }
  }

  return doc;
}

/**
 * @function buildScholarlyWorkSearchDoc
 * @description Build a flat search document for a work or grant from the fully assembled
 * scholarly work graph (post-promoteAttributesToRoot, post-addSearchFieldsToGraph).
 * expert_ids are extracted from the base work node's relatedBy.relates so that
 * per-expert match counts can be aggregated in a single query.
 *
 * @param {Object} graph assembled work/grant document (return of promoteAttributesToRoot)
 * @param {Object} baseWork original framed base work node; used for expert_ids extraction
 * @param {string} swType 'work' or 'grant'
 * @returns {Object} flat search document ready for ae-search indexing
 */
function buildScholarlyWorkSearchDoc(graph, baseWork, swType) {
  const doc = {
    '@id': graph['@id'],
    '@type': swType,
    'is-visible': graph['is-visible'] ?? false,
    'expert_ids': extractExpertIds(baseWork),
  };

  if (graph.name) doc.name = graph.name;
  if (graph.embedding) doc.embedding = graph.embedding;


  // Promote type-specific root fields
  const rootProps = swType === 'grant' ? GRANT_ROOT_PROPS : WORK_ROOT_PROPS;
  for (const prop of rootProps) {
    if (graph[prop] !== undefined) doc[prop] = graph[prop];
  }

  // Pull content fields and search fields from the main work/grant node in @graph.
  // The @graph node is the authoritative source — abstract and other content fields
  // may not be promoted to the root level depending on the data path.
  const workGraphNode = (graph['@graph'] || []).find(n => n['@id'] === graph['@id']);
  if (workGraphNode) {
    // Content fields that may not be at root level
    const contentProps = swType === 'grant'
      ? ['title', 'abstract', 'status', 'type', 'dateTimeInterval', 'sponsorAwardId']
      : ['title', 'abstract', 'issued', 'type', 'DOI'];
    for (const prop of contentProps) {
      if (doc[prop] === undefined && workGraphNode[prop] !== undefined) {
        doc[prop] = workGraphNode[prop];
      }
    }
    // Combined search fields
    for (const f of SEARCH_FIELDS) {
      if (workGraphNode[f] !== undefined) doc[f] = workGraphNode[f];
    }
  }

  return doc;
}

export { buildExpertSearchDoc, buildScholarlyWorkSearchDoc };
