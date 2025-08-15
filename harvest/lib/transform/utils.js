import jsonpath from 'jsonpath';

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

// function getBestFieldValue(fieldName, primaryRecord, records) {
//   // Try primary record first
//   let value = getFieldValue(primaryRecord['api:native']['api:field'] || [], fieldName);
//   if (value) return value;

//   // Fallback to other records for this specific field
//   const preferredSources = ['manual', 'dspace', 'scopus', 'dimensions', 'crossref'];
//   for (const sourceName of preferredSources) {
//     const record = records.find(r => r['source-name'] === sourceName);
//     if (record && record['api:native'] && record['api:native']['api:field']) {
//       value = getFieldValue(record['api:native']['api:field'], fieldName);
//       if (value) return value;
//     }
//   }
//   return null;
// }

function getBestFieldValueFromRecords(fieldName, records) {
  // Priority order matching your SPARQL query
  const sourceOrder = [
    'verified-manual', 'repec', 'dimensions', 'pubmed', 'scopus', 'wos', 'wos-lite',
    'crossref', 'epmc', 'google-books', 'arxiv', 'orcid', 'dblp',
    'cinqii-english', 'figshare', 'cinii-japanese', 'manual', 'dspace'
  ];

  for (const sourceName of sourceOrder) {
    const record = records.find(r => r['source-name'] === sourceName);
    if (record && record['api:native'] && record['api:native']['api:field']) {
      const value = getFieldValue(record['api:native']['api:field'], fieldName);
      if (value) return value;
    }
  }

  // Fallback to any record that has the field
  for (const record of records) {
    if (record['api:native'] && record['api:native']['api:field']) {
      const value = getFieldValue(record['api:native']['api:field'], fieldName);
      if (value) return value;
    }
  }

  return null;
}

function getFieldObject(fields, fieldName) {
  const field = fields.find(f => f.name === fieldName);
  return field ? (field['api:pagination'] || field['api:date'] || field['api:money']) : null;
}

function formatDate(dateObj) {
  if (!dateObj) return null;

  const year = dateObj['api:year'];
  const month = dateObj['api:month'];
  const day = dateObj['api:day'];

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
  getFieldObject,
  formatDate,
  ensureArray,
  extractAsArray
};
