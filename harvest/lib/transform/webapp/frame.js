import fs from 'fs';
import path from 'path';
import jsonld from 'jsonld';
import config from '../../config.js';
import {SHORT_TYPES, getNodeByType} from '../utils.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const contextPath = path.join(__dirname, 'schema', '4', 'context.jsonld');
const contextFile = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
const framePath = path.join(__dirname, 'frames', 'default.json');
const frameFile = JSON.parse(fs.readFileSync(framePath, 'utf8'));

/**
 * @method updateGrantRelatedByRelates
 * @description Update relatedBy relates fields in grant nodes to use simplified expert references
 * @param {*} compacted the compacted document containing grants and expert
 */
function updateGrantRelatedByRelates(compacted) {
  const expertNode = compacted["@graph"].find(
    n => n && (n["@type"] === "Expert" || (Array.isArray(n["@type"]) && n["@type"].includes("Expert")))
  );
  if (!expertNode) return;

  const expertIdStr = expertNode['@id'];
  // const expertLabel = expertNode.label || expertNode.name; // no longer embedded in relates to keep mapping keyword

  compacted["@graph"].forEach(node => {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (!types.some(t => t.includes('Grant'))) return;

    if (Array.isArray(node.relatedBy)) {
      node.relatedBy.forEach(role => {
        if (!role || role.relates === undefined) return;
        // Normalize to array
        let relatesArr = Array.isArray(role.relates) ? role.relates : [role.relates];
        // Flatten any objects to their @id string; ensure expertId present if originally referenced
        const flattened = [];
        relatesArr.forEach(r => {
          if (typeof r === 'string') {
            flattened.push(r);
          } else if (r && typeof r === 'object') {
            if (r['@id']) flattened.push(r['@id']);
          }
        });
        // Remove dups
        role.relates = [...new Set(flattened)];
      });
    }
  });
}

/**
 * @method updateWorkRelatedByRelates
 * @description Update relatedBy relates fields in work nodes to use string expert references
 * Similar to grant pattern but adapted for work authorships
 * @param {*} workDocument the work document containing work and expert nodes
 */
function updateWorkRelatedByRelates(workDocument) {
  // Find the expert node
  const expertNode = workDocument["@graph"].find(
    n => n && (n["@type"] === "Expert" || (Array.isArray(n["@type"]) && n["@type"].includes("Expert")))
  );
  if (!expertNode) return;

  const expertIdStr = expertNode['@id'];

  // Find the work node
  workDocument["@graph"].forEach(node => {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    const isWork = types.some(t =>
      t.includes('Work') ||
      t.includes('ScholarlyArticle') ||
      t.includes('Article') ||
      t.includes('Publication')
    );
    if (!isWork) return;

    // Process relatedBy (authorships)
    if (Array.isArray(node.relatedBy)) {
      node.relatedBy.forEach(authorship => {
        if (!authorship || authorship.relates === undefined) return;
        let relatesArr = Array.isArray(authorship.relates) ? authorship.relates : [authorship.relates];
        // Ensure string @id only; collect ids, add work + expert if present as objects without duplication
        const ids = new Set();
        relatesArr.forEach(r => {
          if (typeof r === 'string') ids.add(r);
          else if (r && typeof r === 'object' && r['@id']) ids.add(r['@id']);
        });
        // Guarantee work id present when authorship references work
        if (!ids.has(node['@id'])) ids.add(node['@id']);
        // Guarantee expert id present when authorship references expert
        if (!ids.has(expertIdStr)) ids.add(expertIdStr);
        authorship.relates = Array.from(ids);
      });
    }
  });
}

/**
 * @method promoteExpertNodeToRoot
 * @description Promotes the expert node to the root of the document,
 * restructures the document to have several properties at the top level.
 *
 * This is pulled from the fin model in AEv2.
 * @param {*} compacted the compacted JSON-LD document
 * @param {*} config the config object with context properties
 * @returns {*} the restructured document
 */
function promoteExpertNodeToRoot(compacted, config) {
  if( typeof compacted["is-visible"] === 'object' ) delete compacted["is-visible"];

  const graph = Array.isArray(compacted?.['@graph']) ? compacted['@graph'] : [];
  const isExpert = (n) => n && (n['@type'] === 'Expert' || (Array.isArray(n['@type']) && n['@type'].includes('Expert')));

  const normalizeShortId = (id) => {
    if (!id || typeof id !== 'string') return id;
    if (id.startsWith('http://experts.ucdavis.edu/expert/')) return id.replace('http://experts.ucdavis.edu/expert/', '');
    if (id.startsWith('expert/')) return id.replace(/^expert\//, '');
    return id;
  };

  const rootShort = normalizeShortId(compacted && compacted['@id']);

  // Prefer the expert whose @id matches the document root @id
  let expertNode = graph.find(n => isExpert(n) && normalizeShortId(n['@id']) === rootShort);
  // Fallback to the first Expert node if no match found
  if (!expertNode) {
    expertNode = graph.find(isExpert);
  }
  if (!expertNode) return compacted;

  const canonicalRootId = rootShort ? `expert/${rootShort}` : expertNode['@id'];

  const doc = {
    "@id": canonicalRootId,
    "@context": (config?.server?.url || 'https://stage.experts.library.ucdavis.edu') + "/api/schema/context.jsonld",
    "@graph": compacted["@graph"],
    "@type": "Expert"
  };

  if( typeof expertNode["is-visible"] === 'object' ) delete expertNode["is-visible"];

  if( expertNode["is-visible"] !== undefined ) {
    doc["is-visible"] = expertNode["is-visible"];
  }
  if (expertNode["hasAvailability"]) {
    doc["hasAvailability"] = Array.isArray(expertNode["hasAvailability"])
      ? [...expertNode["hasAvailability"]]
      : [expertNode["hasAvailability"]];
  }

  let contact = null;
  let hasEmail = [];
  let hasURL = [];
  if (expertNode["contactInfo"]) {
    let contactInfos = Array.isArray(expertNode["contactInfo"]) ? expertNode["contactInfo"] : [expertNode["contactInfo"]];
    contactInfos.sort((a, b) => (a["rank"] || 100) - (b["rank"] || 100));
    contact = contactInfos[0];
    contactInfos.forEach((info) => {
      if (info.hasEmail) hasEmail = hasEmail.concat(info.hasEmail);
      if (info?.hasURL) hasURL = hasURL.concat(info.hasURL);
    });
  }

  doc["contactInfo"] = {};
  if (hasURL.length > 0) doc.contactInfo["hasURL"] = hasURL;
  doc.contactInfo["hasEmail"] = hasEmail?.[0];

  ["name", "hasName", "hasTitle", "hasOrganizationalUnit"].forEach((key) => {
    if (contact && contact[key]) {
      doc.contactInfo[key] = contact[key];
    }
  });
  if (doc.contactInfo.name) {
    doc.name = doc.contactInfo.name;
  }
  if (expertNode["modified-date"]) {
    doc["modified-date"] = expertNode["modified-date"];
  }
  if (expertNode["roles"]) {
    doc["roles"] = expertNode["roles"];
  }

  doc["@graph"] = compacted["@graph"];

  return doc;
}


/**
 * @method normalizeBooleans
 * @description Recursively mutates jsonld boolean values
 * (for example `{"@value": "true", "@type": "xsd:boolean"}`)
 * to native javascript booleans.
 * @param {@} node
 * @returns
 */
const normalizeBooleans = (node) => {
  if (!node || typeof node !== 'object') return;

  Object.keys(node).forEach(k => {
    const v = node[k];
    if (Array.isArray(v)) {
      v.forEach(normalizeBooleans);
    } else if (v && typeof v === 'object') {
      if (
        v['@value'] !== undefined &&
        (v['@type'] === 'xsd:boolean' || v['@type'] === 'http://www.w3.org/2001/XMLSchema#boolean')
      ) {
        node[k] = (v['@value'] === true || v['@value'] === 'true');
      } else {
        normalizeBooleans(v);
      }
    }
  });
};

/**
 * @method normalizeUnicodeSpacesDeep
 * @description Recursively mutates jsonld string values to replace
 * various unicode space characters with regular spaces.
 * Some descriptions in works/grants contain different types of spaces
 * which causes issues during diff comparisons.
 *
 * The following unicode space characters are targeted:
 * ```
 * \u00A0 - Non-breaking space (NBSP)
 * \u202F - Narrow no-break space
 * \u2007 - Figure space
 * \u2000-\u200A - Various em/en spaces, thin spaces, hair spaces, etc.
 * \u205F - Medium mathematical space
 * ```
 * @param {Object} graph
 * @returns {Object} updated graph
 */
const normalizeUnicodeSpacesDeep = (graph) => {
  const seen = new WeakSet();
  const SPACE_RE = /[\u00A0\u202F\u2007\u2000-\u200A\u205F]/g;

  const fixString = (s) => {
    if (typeof s !== 'string') return s;
    return s.replace(SPACE_RE, ' ');
  };

  const recurse = (node) => {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);

    for (const key of Object.keys(node)) {
      const v = node[key];
      if (typeof v === 'string') {
        node[key] = fixString(v);
      } else if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          if (typeof v[i] === 'string') v[i] = fixString(v[i]);
          else if (v[i] && typeof v[i] === 'object') recurse(v[i]);
        }
      } else if (v && typeof v === 'object') {
        recurse(v);
      }
    }
  };

  graph.forEach(n => recurse(n));
  return graph;
};


/**
 * @method normalizeExpertIdsDeep
 * @description Recursively normalizes all expert IDs in the graph to ensure they do not have duplicate 'expert/expert/' segments.
 * @param {*} graph the JSON-LD graph to normalize
 * @returns {*} the normalized graph
 */
const normalizeExpertIdsDeep = (graph) => {
  const seen = new WeakSet();

  const fixIdString = (val) => {
    if (typeof val === 'string' && val.startsWith('expert/expert/')) {
      return val.replace(/^expert\/expert\//, 'expert/');
    }
    return val;
  };

  const recurse = (node) => {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);

    if (node['@id']) {
      node['@id'] = fixIdString(node['@id']);
    }

    for (const key of Object.keys(node)) {
      const v = node[key];

      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          if (v[i] && typeof v[i] === 'object') {
            recurse(v[i]);
          } else {
            v[i] = fixIdString(v[i]);
          }
        }
      } else if (v && typeof v === 'object') {
        recurse(v);
      } else {
        node[key] = fixIdString(v);
      }
    }
  };

  graph.forEach(n => recurse(n));
  return graph;
}

/**
 * @method normalizeScalars
 * @description Recursively mutates jsonld scalar values (boolean, integer, string,
 * for example `{"@value": "true", "@type": "xsd:boolean"}`)
 * to native javascript types.
 * @param {@} node
 * @returns
 */
const normalizeScalars = (node) => {
  if (!node || typeof node !== 'object') return;
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach(normalizeScalars);
    else if (v && typeof v === 'object' && '@value' in v) {
      if (v['@type'] === 'xsd:boolean') node[k] = v['@value'] === true || v['@value'] === 'true';
      else if (v['@type'] === 'xsd:integer') node[k] = parseInt(v['@value'], 10);
      else node[k] = v['@value'];
    } else if (v && typeof v === 'object') normalizeScalars(v);
  }
}

/**
 * @method frame
 * @description Frames the data for indexing into elasticsearch.
 *
 * @param {*} graph the graph to frame
 * @param {boolean} compact whether to compact the framed graph
 * @returns
 */
async function frame(graph, compact=false) {
  if( !graph['@graph'] ) {
    graph['@graph'] = Array.isArray(graph) ? graph : [graph];
  }

  const frameDoc = {
    ...frameFile
  };
  frameDoc["@context"] = contextFile["@context"];

  let framedRaw = await jsonld.frame(
    graph,
    frameDoc,
    {
      embed: '@always',
      omitGraph: false,
      explicit: false,
      requireAll: false
    }
  );
  cleanupFramedDocument(framedRaw);

  if( !compact ) return framedRaw;

  let compacted = await jsonld.compact(framedRaw, contextFile["@context"], {
    embed: '@always'
  }); 

  return compacted;
}

function cleanupFramedDocument(compacted) {
  compacted["@graph"] = normalizeExpertIdsDeep(compacted["@graph"]);
  compacted['@graph'].forEach(normalizeScalars);
  compacted["@graph"].forEach(normalizeBooleans);
  compacted["@graph"] = normalizeUnicodeSpacesDeep(compacted["@graph"]);

  compacted["@graph"].forEach(node => {
    if (node?.author) {
      if (!Array.isArray(node.author)) {
        node.author = [node.author];
      }
      node.author.sort((a, b) => (a?.rank || 0) - (b?.rank || 0));
    }
  });
}

/**
 * @method frame
 * @description Frames the data for indexing into elasticsearch.
 *
 * Generates jsonld files using the frame/context files, as well as updating/promoting
 * properties for the expert/works/grants nodes as needed, using logic that used
 * to reside in the fin model code that run during indexing/updates in AEv2.
 * @param {*} expertId
 * @param {*} graph the graph to frame
 * @returns
 */
async function frameExpert(expertId, graph) {
  const item = {
    "@id": "info:fedora" + expertId,
    "@version": 1.1,
    "@graph": graph
  };

  let compacted = await frame(item, true );


  compacted["@graph"] = compacted["@graph"].filter((node) => {
    // keep everything that is not a relationship path
    if (!(typeof node['@id'] === 'string' && node['@id'].includes('/relationship/'))) return true;

    // if it's a relationship node, only keep it when it's an Authorship-like node
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    const isAuthorship = types.some(t => (typeof t === 'string') && (t.includes('Authorship') || t.includes('ucdlib:Authorship')));
    return isAuthorship;
  });

  if (compacted["@graph"] && Array.isArray(compacted["@graph"])) {
    const expertNodes = [];
    const workNodes = [];
    const grantNodes = [];
    const otherNodes = [];

    // Normalize expert IDs for comparison
    const normalizeId = (id) => {
      if (!id || typeof id !== 'string') return id;
      if (id.startsWith('http://experts.ucdavis.edu/expert/')) return id.replace('http://experts.ucdavis.edu/expert/', '');
      if (id.startsWith('info:fedora/expert/')) return id.replace('info:fedora/expert/', '');
      if (id.startsWith('expert/')) return id.replace(/^expert\//, '');
      return id;
    };
    const primaryExpertIdNormalized = normalizeId(expertId);

    compacted["@graph"].forEach(node => {
      if (!node || !node['@type']) {
        otherNodes.push(node);
        return;
      }
      const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      const isExpert = types.some(t => t.includes('Expert') || t.includes('Person') || t.includes('Agent'));
      const isWork = types.some(t =>
        t.includes('Work') || t.includes('ScholarlyArticle') || t.includes('Article') || t.includes('Publication')
      );
      const isGrant = types.some(t => t.includes('Grant'));

      if (isExpert) {
        // Only keep the primary expert, filter out related experts
        if (normalizeId(node['@id']) === primaryExpertIdNormalized) {
          expertNodes.push(node);
        }
      } else if (isWork) workNodes.push(node);
      else if (isGrant) grantNodes.push(node);
      else otherNodes.push(node);
    });

    compacted["@graph"] = [...expertNodes, ...workNodes, ...grantNodes, ...otherNodes];
  }

  // Ensure the document root @id matches canonical expert/<id> form
  const rootIdShort = expertId;
  const canonicalRoot = rootIdShort.startsWith('expert/') ? rootIdShort : `expert/${rootIdShort}`;
  compacted["@id"] = canonicalRoot;
  compacted["@context"] = (config?.server?.url || 'https://stage.experts.library.ucdavis.edu') + "/api/schema/context.jsonld";


  compacted = promoteExpertNodeToRoot(compacted, config);
  updateWorkRelatedByRelates(compacted);
  updateGrantRelatedByRelates(compacted);
  // Flatten any embedded relates objects across all nodes/roles
  function flattenRelates(doc){
    if (!doc || !Array.isArray(doc['@graph'])) return;
    doc['@graph'].forEach(node => {
      if (!node) return;
      if (node.relates !== undefined) {
        let arr = Array.isArray(node.relates) ? node.relates : [node.relates];
        node.relates = [...new Set(arr.map(r => typeof r === 'string' ? r : (r && r['@id'])).filter(Boolean))];
      }
      if (Array.isArray(node.relatedBy)) {
        node.relatedBy.forEach(role => {
          if (!role || role.relates === undefined) return;
          let arr = Array.isArray(role.relates) ? role.relates : [role.relates];
          role.relates = [...new Set(arr.map(r => typeof r === 'string' ? r : (r && r['@id'])).filter(Boolean))];
        });
      } else if (node.relatedBy && node.relatedBy.relates !== undefined) {
        let arr = Array.isArray(node.relatedBy.relates) ? node.relatedBy.relates : [node.relatedBy.relates];
        node.relatedBy.relates = [...new Set(arr.map(r => typeof r === 'string' ? r : (r && r['@id'])).filter(Boolean))];
      }
    });
  }
  flattenRelates(compacted);

  return compacted;
}

/**
 * @method simplifiedExpert
 * @description Create a simplified expert node from a AE webapp 
 * framed expert node
 * 
 * @param {Object} expertNode the source framed expert node (not the graph)
 * 
 * @return {Object} the simplified expert node
 */
function simplifiedExpert(expertNode) {
  if (!expertNode) return null;

  // If the expert node is still wrapped in a graph, extract it
  if( expertNode['@graph'] ) {
    expertNode = getNodeByType(expertNode, SHORT_TYPES.EXPERT, {match: true});
  } 

  // Prefer explicit contactInfo entries if present
  let contact = null;
  if (expertNode.contactInfo) {
    const infos = Array.isArray(expertNode.contactInfo) ? expertNode.contactInfo.slice() : [expertNode.contactInfo];
    infos.sort((a, b) => ( (a.rank || 100) - (b.rank || 100) ));
    contact = infos[0];
  }

  // Fallback to top-level name if no contact info
  const name = (contact && contact.name) ? contact.name : (expertNode.name || expertNode.label);

  // Build contactInfo entry preserving hasName object and hasEmail when present
  let contactInfoEntry = null;
  if (contact) {
    contactInfoEntry = {};
    if (contact.hasEmail) contactInfoEntry.hasEmail = contact.hasEmail;
    if (contact.hasName) contactInfoEntry.hasName = { ...contact.hasName };
    if (contact.name) contactInfoEntry.name = contact.name;
  }

  return {
    "@id": expertNode["@id"],
    "@type": expertNode["@type"],
    "contactInfo": contactInfoEntry ? [contactInfoEntry] : [],
    "is-visible": expertNode["is-visible"],
    "identifier": expertNode.identifier,
    "orcidId": expertNode.orcidId,
    "name": name
  };
}

export {
  simplifiedExpert,
  frameExpert,
  frame,
}