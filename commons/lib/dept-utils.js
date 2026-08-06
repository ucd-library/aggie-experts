/**
 * Department lookup helpers.
 *
 * These functions are data-injected: callers pass the ORG_LOOKUP table as the
 * first argument rather than the module importing it. This keeps the ~44KB data
 * blob out of any bundle that only needs the (tiny) transform logic — the webapp
 * client fetches ORG_LOOKUP at runtime as a static asset and passes it in, while
 * server-side callers use the ORG_LOOKUP-bound wrappers exported from index.js.
 */

/**
 * Build a flat map of sub-category key → dept array for fast lookups.
 * @param {Array} orgLookup - the ORG_LOOKUP table
 * @returns {Map<string, Array>}
 */
function buildKeyMap(orgLookup) {
  const map = new Map();
  for( const cat of orgLookup ) {
    for( const sub of cat.subCategories ) {
      if( sub.key ) map.set(sub.key, sub.depts);
    }
  }
  return map;
}

/**
 * Serialize an array of selected dept codes into a compact multi-param object.
 *
 * For each sub-category, whichever list is shorter (checked or unchecked) is stored:
 *   - All selected   → key only in `dept`          e.g. dept=AGR
 *   - Majority sel.  → key in `dept` + unchecked codes in `deptCodesExcluded`
 *   - Minority sel.  → checked codes in `deptCodesIncluded`  (key absent from dept)
 *   - None selected  → omitted entirely
 *
 * @param {Array} orgLookup - the ORG_LOOKUP table
 * @param {string[]} selectedCodes - currently selected dept codes
 * @returns {{ dept: string, deptCodesIncluded: string, deptCodesExcluded: string }}
 *   Each value is a comma-separated string; empty string means the param should be omitted.
 */
export function serializeDeptParam(orgLookup, selectedCodes) {
  const selected = new Set(selectedCodes);
  const deptKeys = [];
  const included = [];
  const excluded = [];

  for( const cat of orgLookup ) {
    for( const sub of cat.subCategories ) {
      if( !sub.key ) continue;
      const allCodes = sub.depts.map(d => d.deptCode);
      const checkedCodes = allCodes.filter(c => selected.has(c));
      const uncheckedCodes = allCodes.filter(c => !selected.has(c));

      if( checkedCodes.length === 0 ) continue;

      if( uncheckedCodes.length === 0 ) {
        // all selected — just the key
        deptKeys.push(sub.key);
      } else if( uncheckedCodes.length <= checkedCodes.length ) {
        // majority selected — key + excluded list is shorter
        deptKeys.push(sub.key);
        uncheckedCodes.forEach(c => excluded.push(c));
      } else {
        // minority selected — included list is shorter
        checkedCodes.forEach(c => included.push(c));
      }
    }
  }

  return {
    dept: deptKeys.join(','),
    deptCodesIncluded: included.join(','),
    deptCodesExcluded: excluded.join(','),
  };
}

/**
 * Deserialize dept URL params back to a flat array of dept codes.
 *
 * @param {Array} orgLookup - the ORG_LOOKUP table
 * @param {string} dept - comma-separated sub-category keys (e.g. "AGR,BIO")
 * @param {string} [deptCodesIncluded] - comma-separated codes to add directly
 * @param {string} [deptCodesExcluded] - comma-separated codes to remove from expanded keys
 * @returns {string[]} flat array of dept codes
 */
export function deserializeDeptParam(orgLookup, dept, deptCodesIncluded='', deptCodesExcluded='') {
  if( !dept && !deptCodesIncluded ) return [];

  const keyMap = buildKeyMap(orgLookup);
  const excludeSet = new Set((deptCodesExcluded || '').split(',').filter(Boolean));
  const codes = [];

  for( const token of (dept || '').split(',').filter(Boolean) ) {
    if( keyMap.has(token) ) {
      keyMap.get(token)
        .map(d => d.deptCode)
        .filter(c => !excludeSet.has(c))
        .forEach(c => codes.push(c));
    }
  }

  (deptCodesIncluded || '').split(',').filter(Boolean).forEach(c => {
    if( !codes.includes(c) ) codes.push(c);
  });

  return codes;
}

/**
 * Expand dept URL params to the official department names used by the
 * Elasticsearch index. This is the API-side expansion.
 *
 * @param {Array} orgLookup - the ORG_LOOKUP table
 * @param {string} dept - compact dept param value from URL
 * @param {string} [deptCodesIncluded] - codes to include directly
 * @param {string} [deptCodesExcluded] - codes to exclude from expanded keys
 * @returns {string[]} array of official dept names (hasOrganizationalUnit.name.kw values)
 */
export function expandDeptParam(orgLookup, dept, deptCodesIncluded='', deptCodesExcluded='') {
  const codes = deserializeDeptParam(orgLookup, dept, deptCodesIncluded, deptCodesExcluded);
  return deptCodesToOfficialNames(orgLookup, codes);
}

/**
 * Convert an array of dept codes to their official names for Elasticsearch filtering.
 *
 * @param {Array} orgLookup - the ORG_LOOKUP table
 * @param {string[]} codes - dept codes
 * @returns {string[]} official dept names
 */
export function deptCodesToOfficialNames(orgLookup, codes) {
  const lookup = new Map();
  for( const cat of orgLookup ) {
    for( const sub of cat.subCategories ) {
      for( const d of sub.depts ) {
        lookup.set(d.deptCode, d.officialName);
      }
    }
  }
  return codes.map(c => lookup.get(c)).filter(Boolean);
}
