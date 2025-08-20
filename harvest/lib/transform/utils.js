import jsonpath from 'jsonpath';

const WORKS_SOURCE_ORDER = [
    'verified-manual', 'repec', 'dimensions', 'pubmed', 'scopus', 'wos', 'wos-lite',
    'crossref', 'epmc', 'google-books', 'arxiv', 'orcid', 'dblp',
    'cinqii-english', 'figshare', 'cinii-japanese', 'manual', 'dspace'
  ];

  function sortJsonArrayByIdAndKeys(jsonArray) {
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

function getBestFieldValueFromRecords(fieldName, records) {
  let bestValue = null;
  let bestScore = Infinity;

  for (const record of records) {
    const source = record['source-name'];
    if (!source) continue;
    const order = WORKS_SOURCE_ORDER.indexOf(source);
    if (order === -1) continue;

    const fields = record['api:native']?.['api:field'] || [];
    const value = getFieldValue(fields, fieldName);
    if (!value) continue;

    // DOI boost
    let score = order + 1;
    if (getFieldValue(fields, 'doi')) score -= 10;

    if (score < bestScore) {
      bestScore = score;
      bestValue = value;
    }
  }

  // Fallback to any record with the field
  if (bestValue === null) {
    for (const record of records) {
      const fields = record['api:native']?.['api:field'] || [];
      const value = getFieldValue(fields, fieldName);
      if (value) return value;
    }
  }

  return bestValue;
}

// get best record, and return all values for fieldName from the best record
// also if 2 sources tie for the best score, then return values from both
// this is how the sparql behaved for things like 'title'
function getBestFieldValuesFromRecords(fieldName, records) {
  let bestScore = Infinity;
  let scoredRecords = [];

  for (const record of records) {
    const source = record['source-name'];
    if (!source) continue;
    const order = WORKS_SOURCE_ORDER.indexOf(source);
    if (order === -1) continue;

    const fields = record['api:native']?.['api:field'] || [];
    const matchingFields = fields.filter(f => f.name === fieldName && f['api:text']);
    if (!matchingFields.length) continue;

    let score = order + 1;
    if (fields.some(f => f.name === 'doi')) score -= 10;

    if (score < bestScore) {
      bestScore = score;
      scoredRecords = [{ record, matchingFields }];
    } else if (score === bestScore) {
      scoredRecords.push({ record, matchingFields });
    }
  }

  // Collect all values from all matching fields in all best-score records
  let bestValues = [];
  for (const { matchingFields } of scoredRecords) {
    bestValues.push(
      ...matchingFields.flatMap(f =>
        Array.isArray(f['api:text']) ? f['api:text'] : [f['api:text']]
      )
    );
  }

  // Fallback: any record with the field
  if (!bestValues.length) {
    for (const record of records) {
      const fields = record['api:native']?.['api:field'] || [];
      const matchingFields = fields.filter(f => f.name === fieldName && f['api:text']);
      if (matchingFields.length) {
        return matchingFields.flatMap(f =>
          Array.isArray(f['api:text']) ? f['api:text'] : [f['api:text']]
        );
      }
    }
  }

  return bestValues;
}

function getFieldObject(fields, fieldName) {
  const field = fields.find(f => f.name === fieldName);
  return field ? (field['api:pagination'] || field['api:date'] || field['api:money']) : null;
}

function formatDate(dateObj) {
  if (!dateObj) return null;

  const year = dateObj['api:year'];
  const month = dateObj['api:month'] || '01';
  const day = dateObj['api:day'] || '01';

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

export {
  sortJsonArrayByIdAndKeys,
  sortJsonRecursively,
  getFieldValue,
  getBestFieldValueFromRecords,
  getBestFieldValuesFromRecords, // multiple values from same best
  getFieldObject,
  formatDate,
  ensureArray,
  extractAsArray,
  WORKS_SOURCE_ORDER,
};
