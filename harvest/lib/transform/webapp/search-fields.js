/**
 * @module search-fields
 * @description Utility for building denormalized combined text search fields on
 * individual @graph nodes. These fields are consumed by the imperative search
 * implementation (complete-imperative.js) and indexed via experts-schema.json.
 *
 * Four combined fields are produced per node, grouping source fields by semantic role:
 *   - search_name         names of people (family, given, middle, author names)
 *   - search_title        document or job titles
 *   - search_identifiers  IDs, DOIs, ORCIDs, emails, and other identifiers
 *   - search_description  descriptive text (abstract, overview, org unit, journal, etc.)
 *
 * Field assignment varies by node @type (Expert, Work, Grant).
 * Simplified expert nodes embedded in work/grant documents are handled via
 * the Expert type path since they retain their @type value.
 */

/**
 * @function _push
 * @description Append non-empty string values to an array.
 * @param {Array} arr target array
 * @param {...*} vals values to push (non-string and empty values are ignored)
 */
function _push(arr, ...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) arr.push(v.trim());
  }
}

/**
 * @function _pushItems
 * @description Append values from a field that may be a single item or array.
 * Objects are resolved by the given key (default 'name').
 * @param {Array} arr target array
 * @param {*} source value or array of values
 * @param {String} [key='name'] property key to extract from object items
 */
function _pushItems(arr, source, key = 'name') {
  if (!source) return;
  const items = Array.isArray(source) ? source : [source];
  for (const item of items) {
    if (typeof item === 'string') _push(arr, item);
    else if (item && typeof item === 'object') _push(arr, item[key]);
  }
}

/**
 * @function buildNodeSearchFields
 * @description Compute combined search field values for a single @graph node.
 * Returns undefined for fields that have no content so callers can skip assignment.
 *
 * @param {Object} node a single node from a document's @graph array
 * @returns {Object} object with optional search_name, search_title,
 *   search_identifiers, and search_description string properties
 */
function buildNodeSearchFields(node) {
  if (!node || typeof node !== 'object') return {};

  const types = Array.isArray(node['@type'])
    ? node['@type']
    : (node['@type'] ? [node['@type']] : []);

  const isExpert = types.some(t => t && t.includes('Expert'));
  const isWork = types.some(t => t && (
    t.includes('Work') ||
    t.includes('ScholarlyArticle') ||
    t.includes('Article') ||
    t.includes('Publication')
  ));
  const isGrant = types.some(t => t && t.includes('Grant'));

  const name = [];
  const title = [];
  const identifiers = [];
  const description = [];

  // Fields present on all node types
  _push(name, node.name);
  _push(identifiers, node['@id']);
  _pushItems(identifiers, node.identifier);

  if (isExpert) {
    // contactInfo may be an object (full expert) or array (simplified expert embedded in works)
    const ciItems = Array.isArray(node.contactInfo)
      ? node.contactInfo
      : (node.contactInfo ? [node.contactInfo] : []);

    for (const ci of ciItems) {
      if (!ci) continue;
      const hn = ci.hasName;
      if (hn) _push(name, hn.family, hn.given, hn.middle);
      if (ci.hasTitle) _push(title, ci.hasTitle.name);
      if (ci.hasEmail) _push(identifiers, ci.hasEmail);
      if (ci.hasURL) _pushItems(description, ci.hasURL, 'name');
      if (ci.hasOrganizationalUnit) _pushItems(description, ci.hasOrganizationalUnit, 'name');
    }

    _push(identifiers, node.orcidId);
    _push(description, node.overview);
  }

  if (isWork) {
    const authors = Array.isArray(node.author) ? node.author : (node.author ? [node.author] : []);
    for (const a of authors) {
      _push(name, a.family, a.given);
    }
    _push(title, typeof node.title === 'string' ? node.title : null);
    _push(identifiers, node.DOI);
    _push(description, node.abstract, node['container-title'], node.publisher);
  }

  if (isGrant) {
    _push(title, typeof node.title === 'string' ? node.title : null);
    _push(identifiers, node.DOI, node.sponsorAwardId);
    _push(description, node.abstract);
  }

  // Fall back for nodes with top-level hasName (older simplified expert format)
  if (!isExpert && !isWork && !isGrant && node.hasName) {
    const hn = node.hasName;
    _push(name, hn.family, hn.given, hn.middle);
    _push(identifiers, node.orcidId);
  }

  const join = arr => arr.length ? arr.join(' ') : undefined;

  return {
    search_name: join(name),
    search_title: join(title),
    search_identifiers: identifiers.length ? identifiers : undefined,
    search_description: join(description)
  };
}

/**
 * @function addSearchFieldsToGraph
 * @description Add combined search fields to every node in a document's @graph array.
 * Mutates each node in place. Should be called after flattenScholarlyWorksRelatedBy
 * so that relates/relatedBy are in their final indexed form.
 *
 * @param {Object} doc root document object with a @graph array property
 */
function addSearchFieldsToGraph(doc) {
  if (!doc || !Array.isArray(doc['@graph'])) return;

  for (const node of doc['@graph']) {
    if (!node) continue;
    const fields = buildNodeSearchFields(node);
    if (fields.search_name !== undefined) node.search_name = fields.search_name;
    if (fields.search_title !== undefined) node.search_title = fields.search_title;
    if (fields.search_identifiers !== undefined) node.search_identifiers = fields.search_identifiers;
    if (fields.search_description !== undefined) node.search_description = fields.search_description;
  }
}

export { buildNodeSearchFields, addSearchFieldsToGraph };
