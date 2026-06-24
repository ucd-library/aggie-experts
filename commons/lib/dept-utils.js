import { ORG_LOOKUP } from './org-lookup.js';

/**
 * Build a flat map of sub-category key → dept array for fast lookups.
 * @returns {Map<string, Array>}
 */
function buildKeyMap() {
  const map = new Map();
  for( const cat of ORG_LOOKUP ) {
    for( const sub of cat.subCategories ) {
      if( sub.key ) map.set(sub.key, sub.depts);
    }
  }
  return map;
}

const KEY_MAP = buildKeyMap();

/**
 * Serialize an array of selected dept codes into a compact multi-param object.
 *
 * For each sub-category, whichever list is shorter (checked or unchecked) is stored:
 *   - All selected   → key only in `dept`          e.g. dept=AGR
 *   - Majority sel.  → key in `dept` + unchecked codes in `deptCodesExcluded`
 *   - Minority sel.  → checked codes in `deptCodesIncluded`  (key absent from dept)
 *   - None selected  → omitted entirely
 *
 * @param {string[]} selectedCodes - currently selected dept codes
 * @returns {{ dept: string, deptCodesIncluded: string, deptCodesExcluded: string }}
 *   Each value is a comma-separated string; empty string means the param should be omitted.
 */
export function serializeDeptParam(selectedCodes) {
  const selected = new Set(selectedCodes);
  const deptKeys = [];
  const included = [];
  const excluded = [];

  for( const cat of ORG_LOOKUP ) {
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
 * @param {string} dept - comma-separated sub-category keys (e.g. "AGR,BIO")
 * @param {string} [deptCodesIncluded] - comma-separated codes to add directly
 * @param {string} [deptCodesExcluded] - comma-separated codes to remove from expanded keys
 * @returns {string[]} flat array of dept codes
 */
export function deserializeDeptParam(dept, deptCodesIncluded='', deptCodesExcluded='') {
  if( !dept && !deptCodesIncluded ) return [];

  const excludeSet = new Set((deptCodesExcluded || '').split(',').filter(Boolean));
  const codes = [];

  for( const token of (dept || '').split(',').filter(Boolean) ) {
    if( KEY_MAP.has(token) ) {
      KEY_MAP.get(token)
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
 * @param {string} dept - compact dept param value from URL
 * @param {string} [deptCodesIncluded] - codes to include directly
 * @param {string} [deptCodesExcluded] - codes to exclude from expanded keys
 * @returns {string[]} array of official dept names (hasOrganizationalUnit.name.kw values)
 */
export function expandDeptParam(dept, deptCodesIncluded='', deptCodesExcluded='') {
  const codes = deserializeDeptParam(dept, deptCodesIncluded, deptCodesExcluded);
  return deptCodesToOfficialNames(codes);
}

/**
 * Convert an array of dept codes to their official names for Elasticsearch filtering.
 *
 * @param {string[]} codes - dept codes
 * @returns {string[]} official dept names
 */
export function deptCodesToOfficialNames(codes) {
  const lookup = new Map();
  for( const cat of ORG_LOOKUP ) {
    for( const sub of cat.subCategories ) {
      for( const d of sub.depts ) {
        lookup.set(d.deptCode, d.officialName);
      }
    }
  }
  return codes.map(c => lookup.get(c)).filter(Boolean);
}
