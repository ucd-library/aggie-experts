
function verifyTransformations(original, newVersion, opts) {
  if( !Array.isArray(original) || !Array.isArray(newVersion) ) {
    throw new Error("Both original and newVersion must be arrays"); 
  }

  let oNodes = new Map();
  let nNodes = new Map();

  original.forEach(node => {
    if (node['@id']) {
      oNodes.set(node['@id'], node);
    } else {
      throw new Error("Original node must have an id");
    }
  });

  newVersion.forEach(node => {
    if (node['@id']) {
      nNodes.set(node['@id'], node);
    } else {
      throw new Error("New version node must have an id");
    }
  });
  let changes = [];

  oNodes.forEach((oNode, id) => {
    if (!nNodes.has(id)) {
      changes.push({ action: 'remove', id });
    } else {
      let nNode = nNodes.get(id);

      // Check if the node has changed
      let hasChanged = false;
      for (let key in nNode) {
        hasChanged = changed(nNode[key], oNode[key]);
        if (hasChanged) {
          hasChanged.key = key;
          break;
        }
      }
      for( let key in oNode) {
        hasChanged = changed(nNode[key], oNode[key])
        if ( hasChanged ) {
          hasChanged.key = key; // Store the key that changed
          break;
        }
      }

      if (!hasChanged) {
        return; // No change detected, skip
      }

      let change = { action: 'update', id: id, changed: hasChanged };
      changes.push(change);
    }
  });

  nNodes.forEach((nNode, id) => {
    if (!oNodes.has(id)) {
      changes.push({ action: 'add', id});
    }
  });

  return changes;
}

function changed(v1, v2) {
  if( typeof v1 !== typeof v2 ) {
    return {v1, v2};
  }
  if( typeof v1 === 'object' && v1 !== null && v2 !== null ) {
    if( Array.isArray(v1) && Array.isArray(v2) ) {
      return arrayChanged(v1, v2);
    } else {
      let keys1 = Object.keys(v1);
      let keys2 = Object.keys(v2);
      if( keys1.length !== keys2.length ) {
        return { v1, v2 };
      }
      for( let key of keys1 ) {
        if( !keys2.includes(key) || changed(v1[key], v2[key]) ) {
          return { key, new: v1[key], old: v2[key] };
        }
      }
      return false;
    }
  }
  return v1 !== v2 ? { v1, v2 } : false; // For primitive types, just check equality
}

function arrayChanged(a1, a2) {
  let v1 = a1.map(item => item['@id'] || item['@value'] || item);
  let v2 = a2.map(item => item['@id'] || item['@value'] || item);
  for( let i = 0; i < v1.length; i++ ) {
    if( !v2.includes(v1[i]) ) {
      console.log({a1, a2});
      return { type: 'array-item-missing', new: v1[i], old: null };
    }
  }
  for( let i = 0; i < v2.length; i++ ) {
    if( !v1.includes(v2[i]) ) {
      return { type: 'array-item-added', new: null, old: v2[i] };
    }
  }
  return false;
}


export default verifyTransformations;