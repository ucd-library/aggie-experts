
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

function getFieldValue(fields, fieldName) {
  const field = fields.find(f => f.name === fieldName);
  return field?.['api:text'];
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

export {
  sortJsonArrayByIdAndKeys,
  getFieldValue,
  getFieldObject,
  formatDate
};
