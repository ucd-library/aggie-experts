import jsonpath from 'jsonpath';
import config from '../config.js';

const WORKS_SOURCE_ORDER = [
  'verified-manual', 'repec', 'dimensions', 'pubmed', 'scopus', 'wos', 'wos-lite',
  'crossref', 'epmc', 'google-books', 'arxiv', 'orcid', 'dblp',
  'cinqii-english', 'figshare', 'cinii-japanese', 'manual', 'dspace'
];

const WORKS_TYPE_MAP = {
  "book": "book",
  "chapter": "chapter",
  "conference": "paper-conference",
  "journal-article": "article-journal",

  // these are commented out of sparql:
  // #("dataset" false ucdlib:Work "dataset" "")
  // #("internet-publication" false ucdlib:Work "webpage" "")
  // #("media" false ucdlib:Work "article" "media")
  // #("other" false ucdlib:Work "article" "other")
  // #("poster" false ucdlib:Work "speech" "poster")
  // #("preprint" false ucdlib:Preprint "article" "preprint" )
  // #("presentation" false ucdlib:Work "speech" "presentation")
  // #("report" false ucdlib:Work "report" "")
  // #("scholarly-edition" false ucdlib:Work "manuscript" "scholarly-edition")
  // #("software" false ucdlib:Work "software" "")
  // #("thesis-dissertation" false ucdlib:Work "thesis" "dissertation")
};

const SHORT_TYPES = {
  WORKS : ['Work', 'Article', 'Publication'],
  GRANTS : ['Grant'],
  ROLES : ['ResearcherRole', 'GrantRole', 'Authorship'],
  EXPERT : ['Expert', 'Person', 'FacultyMember']
}

const SCHEMA_URI_TYPE_MAP = {
    "book": "http://schema.org/Book",
    "chapter": "http://schema.org/Chapter",
    "conference": "http://schema.org/ScholarlyArticle",
    "journal-article": "http://schema.org/ScholarlyArticle"

    // as type_map above, others commented out
  };

/**
 * @method computeRecordScore
 * @description Compute a score for a work record based on its source and fields, and a DOI boost.
 * Summary: the DOI "boost" is a fixed negative adjustment applied to a record's base score
 *   so records that contain a DOI are strongly preferred. SPARQL computes a numeric score per record
 *   (source-order position + 1) then subtracts the DOI boost (10 in your code). The query then uses
 *   MIN(score) per field and returns values from all records whose score equals that minimum.
 * Effect: a record with a DOI will get score = (order + 1) - DOI_BOOST. Because DOI_BOOST (10)
 *   is large relative to order differences, any record with a DOI usually wins over records without
 *   a DOI unless source-order index is very different. If multiple records tie with the same min
 *   score, SPARQL returns values from all of them.
 */
function computeRecordScore(record) {
  // equiv to sparql code:
  // BIND((?order + 1) AS ?baseScore)
  // BIND(IF(EXISTS { ?record :native/:field [ :name "doi" ] } , ?baseScore - 10, ?baseScore) AS ?score)
  // ...
  // GROUP BY ?pub ?field_name
  // BIND(min(?score) AS ?min_score)
  // # then join back to records where ?score = ?min_score and pull their values

  const DOI_BOOST = 10;

  const source = record && record['source-name'];
  if (!source) return Infinity;
  const order = WORKS_SOURCE_ORDER.indexOf(source);
  if (order === -1) return Infinity;
  let score = order + 1;
  const fields = record['api:native']?.['api:field'] || [];
  // treat presence of a doi field as the boost trigger (case-insensitive safe)
  if (fields.some(f => f && typeof f.name === 'string' && f.name.toLowerCase() === 'doi')) {
    score -= DOI_BOOST;
  }
  return score;
}

function sortJsonArrayByIdAndKeys(jsonArray) {
  // If sorting of ae-std files not enabled, return original array unchanged
  if (!config?.transform?.stdSort) return jsonArray;

  // sort the array by '@id', then by keys for each
  jsonArray.sort((a, b) => {
    if (a['@id'] < b['@id']) return -1;
    if (a['@id'] > b['@id']) return 1;
    return 0;
  });

  return jsonArray.map(obj => {
    const sortedKeys = Object.keys(obj).filter(k => k !== '@id').sort();
    const newObj = { '@id': obj['@id'] };
    for (const key of sortedKeys) {
      newObj[key] = obj[key];
    }
    return newObj;
  });
}

function sortJsonRecursively(obj) {
  // If sorting is disabled, return the object as-is
  if (!config?.transform?.stdSort) return obj;

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    // For arrays, sort each element recursively, then sort the array itself
    return obj
      .map(item => sortJsonRecursively(item))
      .sort((a, b) => {
        // Sort by @id if both items have it
        if (a && typeof a === 'object' && a['@id'] &&
            b && typeof b === 'object' && b['@id']) {
          return a['@id'].localeCompare(b['@id']);
        }

        // Fall back to string representation
        const aStr = typeof a === 'string' ? a : JSON.stringify(a);
        const bStr = typeof b === 'string' ? b : JSON.stringify(b);
        return aStr.localeCompare(bStr);
      });
  }

  // For objects, sort keys and recursively sort values
  const sortedObj = {};
  const sortedKeys = Object.keys(obj).sort();

  for (const key of sortedKeys) {
    sortedObj[key] = sortJsonRecursively(obj[key]);
  }

  return sortedObj;
}

function getFieldValue(fields, fieldName) {
  const field = fields.find(f => f.name === fieldName);
  return field?.['api:text'];
}

/**
 * @method getBestFieldValueFromRecords
 * @description Get the best field value from records based on a scoring function.
 * only on known sources, ie WORKS_SOURCE_ORDER from this file
 */
function getBestFieldValueFromRecords(fieldName, records, scorer = computeRecordScore) {
  let bestScore = Infinity;
  const bestRecords = [];

  for (const rec of records || []) {
    const fields = rec?.['api:native']?.['api:field'] || [];
    const matching = fields.filter(f => f && f.name === fieldName && (f['api:text'] || f['api:url'] || f['api:pagination']));
    if (!matching.length) continue;

    const score = typeof scorer === 'function' ? scorer(rec) : computeRecordScore(rec);

    // ignore records with unknown/invalid score so they don't tie as "best"
    if (!isFinite(score)) continue;

    if (score < bestScore) {
      bestScore = score;
      bestRecords.length = 0;
      bestRecords.push({ rec, matching });
    } else if (score === bestScore) {
      bestRecords.push({ rec, matching });
    }
  }

  // fallback: first record that has the field and a known source (match SPARQL behavior)
  if (bestRecords.length === 0) {
    for (const rec of records || []) {
      const source = rec?.['source-name'];
      const order = WORKS_SOURCE_ORDER.indexOf(source);
      if (order === -1) continue; // skip unknown sources
      const fields = rec?.['api:native']?.['api:field'] || [];
      const matching = fields.filter(f => f && f.name === fieldName && (f['api:text'] || f['api:url'] || f['api:pagination']));
      if (matching.length) { bestRecords.push({ rec, matching }); break; }
    }
  }

  if (!bestRecords.length) return null;

  // Return the first sensible value from bestRecords (preserve the record order)
  for (const { matching } of bestRecords) {
    for (const f of matching) {
      if (f['api:text']) {
        return Array.isArray(f['api:text']) ? f['api:text'][0] : f['api:text'];
      } else if (f['api:url']) {
        return Array.isArray(f['api:url']) ? f['api:url'][0] : f['api:url'];
      } else if (f['api:pagination']) {
        const b = f['api:pagination']['api:begin-page'];
        const e = f['api:pagination']['api:end-page'];
        if (b && e) return `${b}-${e}`;
        if (b) return b;
      }
    }
  }

  return null;
}

/**
 * @method getBestFieldValuesFromRecords
 * @description Get the best field values from records based on a scoring function.
 * get best record, and return all values for fieldName from the best record
 * also if 2 sources tie for the best score, then return values from both
 * this is how the sparql behaved for things like 'title'.
 * also fallback only on known sources, ie WORKS_SOURCE_ORDER from this file
 */
function getBestFieldValuesFromRecords(fieldName, records, scorer = computeRecordScore) {
  let bestScore = Infinity;
  const bestRecords = [];

  for (const rec of records || []) {
    const fields = rec?.['api:native']?.['api:field'] || [];
    const matching = fields.filter(f => f && f.name === fieldName && (f['api:text'] || f['api:url'] || f['api:pagination']));
    if (!matching.length) continue;

    const score = typeof scorer === 'function' ? scorer(rec) : computeRecordScore(rec);

    // ignore records with unknown/invalid score so they don't tie as "best"
    if (!isFinite(score)) continue;

    if (score < bestScore) {
      bestScore = score;
      bestRecords.length = 0;
      bestRecords.push({ rec, matching });
    } else if (score === bestScore) {
      bestRecords.push({ rec, matching });
    }
  }

  // fallback: first record that has the field and a known source (match SPARQL behavior)
  if (bestRecords.length === 0) {
    for (const rec of records || []) {
      const source = rec?.['source-name'];
      const order = WORKS_SOURCE_ORDER.indexOf(source);
      if (order === -1) continue; // skip unknown sources
      const fields = rec?.['api:native']?.['api:field'] || [];
      const matching = fields.filter(f => f && f.name === fieldName && (f['api:text'] || f['api:url'] || f['api:pagination']));
      if (matching.length) { bestRecords.push({ rec, matching }); break; }
    }
  }

  const values = [];
  for (const { matching } of bestRecords) {
    for (const f of matching) {
      if (f['api:text']) {
        if (Array.isArray(f['api:text'])) values.push(...f['api:text']);
        else values.push(f['api:text']);
      } else if (f['api:url']) {
        if (Array.isArray(f['api:url'])) values.push(...f['api:url']);
        else values.push(f['api:url']);
      } else if (f['api:pagination']) {
        const b = f['api:pagination']['api:begin-page'];
        const e = f['api:pagination']['api:end-page'];
        if (b && e) values.push(`${b}-${e}`);
        else if (b) values.push(b);
      }
    }
  }

  return [...new Set(values)];
}

function getFieldObject(fields, fieldName) {
  const field = fields.find(f => f.name === fieldName);
  return field ? (field['api:pagination'] || field['api:date'] || field['api:money']) : null;
}

function formatDate(dateObj) {
  if (!dateObj) return null;

  const year = dateObj['api:year'];
  const month = dateObj['api:month']; // || '01';
  const day = dateObj['api:day']; // || '01';

  if (year && month && day) {
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  } else if (year && month) {
    return `${year}-${month.toString().padStart(2, '0')}`;
  } else if (year) {
    return year.toString();
  }

  return null;
}

/**
 * Ensures a value is always returned as an array
 * Handles the common pattern where API responses can be either an object or array
 * @param {*} value - The value to normalize to an array
 * @returns {Array} - Always returns an array
 */
function ensureArray(value) {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Safely extracts a nested property and ensures it's an array
 * @param {Object} obj - The object to extract from
 * @param {string} path - JSONPath expression
 * @returns {Array} - Always returns an array
 */
function extractAsArray(obj, path) {
  const result = jsonpath.value(obj, path);
  return ensureArray(result);
}

/**
 * @function getGraphAsItems
 * @description Utility function to extract items from a JSON-LD graph structure, 
 * handling cases where the input may be an array, an object with a @graph property, or a single object.
 * 
 * @param {*} obj 
 * 
 * @returns {Array} - Always returns an array
 */
function getGraphAsItems(obj={}) {
  if( Array.isArray(obj) ) return obj;

  let graph = obj['@graph'];
  if( Array.isArray(graph) ) return graph;

  return [obj];
}

/**
 * @method asArray
 * @description Utility function to ensure a value is always returned as an array.
 * 
 * @param {*} value - The value to normalize to an array
 * 
 * @returns {Array} - Always returns an array
 */
function asArray(value) {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * @method getNodeByType
 * @description Utility function to find a node of a given type in a 
 * JSON-LD graph structure.
 * 
 * @param {Object|Array} graph - The JSON-LD graph or array of nodes
 * @param {string|Array} types - The type(s) to match
 * @param {Object} opts - Options for matching
 * @param {boolean} opts.match - If true, performs partial match on type strings
 * @returns {Object|null} - The first matching node or null if none found
 */
function getNodeByType(graph, types, opts={}) {
  graph = getGraphAsItems(graph);
  types = asArray(types);
  
  for( let node of graph ) {
    if( !node['@type'] ) continue;

    const nodeTypes = asArray(node['@type']);

    if( opts.match ) {
      for( let matchType of types ) {
        for( let type of nodeTypes ) {
          if( type.includes(matchType) ) {
            return node;
          }
        }
      }
    } else {
      if( nodeTypes.some(t => types.includes(t)) ) {
        return node;
      }
    }
  }

  return null;
}

export {
  asArray,
  getNodeByType,
  sortJsonArrayByIdAndKeys,
  sortJsonRecursively,
  getFieldValue,
  getGraphAsItems,
  getBestFieldValueFromRecords,
  getBestFieldValuesFromRecords, // multiple values from same best
  getFieldObject,
  formatDate,
  ensureArray,
  extractAsArray,
  computeRecordScore,
  SHORT_TYPES,
  WORKS_SOURCE_ORDER,
  WORKS_TYPE_MAP,
  SCHEMA_URI_TYPE_MAP,
};
