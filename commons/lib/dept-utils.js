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
 * Serialize an array of dept codes to a compact URL parameter string.
 * Sub-categories where all depts are selected are represented by their key.
 * Any remaining individually-selected codes are appended as `deptCodes:c1,c2`.
 *
 * Example output: `"AGR,BIO,deptCodes:24017,24020"`
 *
 * @param {string[]} selectedCodes - currently selected dept codes
 * @returns {string} compact dept param value
 */
export function serializeDeptParam(selectedCodes) {
  const remaining = new Set(selectedCodes);
  const parts = [];

  for( const cat of ORG_LOOKUP ) {
    for( const sub of cat.subCategories ) {
      if( !sub.key ) continue;
      const allCodes = sub.depts.map(d => d.deptCode);
      if( allCodes.every(c => remaining.has(c)) ) {
        parts.push(sub.key);
        allCodes.forEach(c => remaining.delete(c));
      }
    }
  }

  if( remaining.size ) {
    parts.push(`deptCodes:${[...remaining].join(',')}`);
  }

  return parts.join(',');
}

/**
 * Deserialize a compact dept param string back to an array of dept codes.
 * Expands sub-category keys to all their dept codes and appends any deptCodes.
 *
 * @param {string} param - compact dept param value from URL
 * @returns {string[]} flat array of dept codes
 */
export function deserializeDeptParam(param) {
  if( !param ) return [];
  const codes = [];

  // deptCodes is always last — strip it off before splitting by comma
  // so its own comma-separated values aren't mangled by the outer split
  let keyPart = param;
  const extraIdx = param.indexOf('deptCodes:');
  if( extraIdx !== -1 ) {
    param.slice(extraIdx + 'deptCodes:'.length).split(',').filter(Boolean).forEach(c => codes.push(c));
    keyPart = param.slice(0, extraIdx).replace(/,$/, '');
  }

  for( const token of keyPart.split(',').filter(Boolean) ) {
    if( KEY_MAP.has(token) ) {
      KEY_MAP.get(token).forEach(d => codes.push(d.deptCode));
    }
  }

  return codes;
}

/**
 * Expand a compact dept param string to the official department names used by
 * the Elasticsearch index. This is the API-side expansion.
 *
 * @param {string} param - compact dept param value from URL
 * @returns {string[]} array of official dept names (hasOrganizationalUnit.name.kw values)
 */
export function expandDeptParam(param) {
  const codes = deserializeDeptParam(param);
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
