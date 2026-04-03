import crypto from 'crypto';
import path from 'path';
import { logger, config, getYearWeek } from '@ucd-lib/experts-commons';
import cache from '../cache.js';

// Work JSON-LD predicates (citationstyles / schema.library.ucdavis.edu ae-std format)
const WORK_TYPE   = 'http://schema.library.ucdavis.edu/schema#Work';
const TITLE       = 'http://citationstyles.org/schema/title';
const ABSTRACT    = 'http://citationstyles.org/schema/abstract';
const CONTAINER_TITLE = 'http://citationstyles.org/schema/container-title';
const PUBLISHER   = 'http://citationstyles.org/schema/publisher';
const WORK_TYPE_FIELD = 'http://citationstyles.org/schema/type';
const AUTHOR      = 'http://citationstyles.org/schema/author';
const FAMILY      = 'http://citationstyles.org/schema/family';
const GIVEN       = 'http://citationstyles.org/schema/given';
const ISSUED      = 'http://citationstyles.org/schema/issued';

// Grant JSON-LD predicates (VIVO ontology / schema.library.ucdavis.edu ae-std format)
const GRANT_TYPE           = 'http://vivoweb.org/ontology/core#Grant';
const GRANT_TYPE_PREFIX    = 'http://schema.library.ucdavis.edu/schema#Grant';
const GRANT_NAME           = 'http://schema.org/name';
const GRANT_ASSIGNED_BY    = 'http://vivoweb.org/ontology/core#assignedBy';
const GRANT_SPONSOR_AWARD_ID = 'http://vivoweb.org/ontology/core#sponsorAwardId';
const GRANT_DATE_TIME_INTERVAL = 'http://vivoweb.org/ontology/core#dateTimeInterval';
const GRANT_START          = 'http://vivoweb.org/ontology/core#start';
const GRANT_END            = 'http://vivoweb.org/ontology/core#end';
const GRANT_DATE_TIME      = 'http://vivoweb.org/ontology/core#dateTime';
const GRANT_TOTAL_AWARD_AMOUNT = 'http://vivoweb.org/ontology/core#totalAwardAmount';

/**
 * @function getValues
 * @description Extract array of @values from a JSON-LD property array on a node.
 * @param {Object} node - JSON-LD node object
 * @param {String} prop - property URI
 * @returns {Array<String>} array of string values
 */
function getValues(node, prop) {
  const vals = node[prop];
  if (!vals) return [];
  return (Array.isArray(vals) ? vals : [vals]).map(v => v['@value']).filter(Boolean);
}

/**
 * @function buildNodeMap
 * @description Build a Map from @id to node for quick lookup across a graph.
 * @param {Array} graph - array of JSON-LD node objects
 * @returns {Map<String, Object>} map of @id string to node object
 */
function buildNodeMap(graph) {
  const map = new Map();
  if (!Array.isArray(graph)) return map;
  for (const node of graph) {
    if (node['@id']) map.set(node['@id'], node);
  }
  return map;
}

/**
 * @function hashText
 * @description Compute a SHA-256 hex digest of a string.
 * @param {String} text - input string to hash
 * @returns {String} hex-encoded SHA-256 hash
 */
function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * @function normalizeVector
 * @description L2-normalize a vector so its magnitude equals 1.
 * Required for dot_product similarity in Elasticsearch.
 * If the magnitude is zero, the original vector is returned unchanged.
 * @param {Array<Number>} vector - input embedding vector
 * @returns {Array<Number>} unit-length vector
 */
function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vector;
  return vector.map(v => v / magnitude);
}

/**
 * @function clipVector
 * @description Clip a vector to the first maxLength dimensions.
 * Embedding models place the most semantically significant components at the
 * front of the vector, so truncating from the end is safe for dimensionality
 * reduction.
 * @param {Array<Number>} vector - input embedding vector
 * @param {Number} maxLength - maximum number of dimensions to keep
 * @returns {Array<Number>} clipped vector
 */
function clipVector(vector, maxLength) {
  if (!maxLength || maxLength >= vector.length) return vector;
  return vector.slice(0, maxLength);
}

/**
 * @function postProcessVector
 * @description Apply optional clip and normalize to a raw embedding vector.
 * Clip is applied before normalize so normalization uses the reduced dimensions.
 * @param {Array<Number>} vector - raw embedding vector
 * @param {Object} opts options object
 * @param {Number} opts.maxLength - clip to this many dimensions before returning
 * @param {Boolean} opts.normalize - L2-normalize the (possibly clipped) vector
 * @returns {Array<Number>} processed vector
 */
function postProcessVector(vector, opts={}) {
  let result = vector;
  if (opts.maxLength) result = clipVector(result, opts.maxLength);
  if (opts.normalize) result = normalizeVector(result);
  return result;
}

/**
 * @function buildWorkEmbedText
 * @description Build a human-readable text representation of a work for embedding.
 * Extracts title, authors, journal, publisher, date, type, and abstract from the
 * ae-std JSON-LD graph (full predicate URIs).
 * @param {Array} graph - array of JSON-LD node objects from ae-std format
 * @returns {String} formatted text to feed into the embedding model
 */
function buildWorkEmbedText(graph) {
  const workNode = graph.find(node => {
    const types = node['@type'] || [];
    return (Array.isArray(types) ? types : [types]).includes(WORK_TYPE);
  });
  if (!workNode) throw new Error('No work node found in graph');

  const nodeMap = buildNodeMap(graph);
  const parts = [];

  const titles = getValues(workNode, TITLE);
  if (titles.length) parts.push('Title: ' + titles.join('; '));

  const authorRefs = workNode[AUTHOR] || [];
  const authorNames = [];
  for (const ref of (Array.isArray(authorRefs) ? authorRefs : [authorRefs])) {
    const authorNode = nodeMap.get(ref['@id']);
    if (!authorNode) continue;
    const family = getValues(authorNode, FAMILY)[0] || '';
    const given  = getValues(authorNode, GIVEN)[0] || '';
    if (family || given) authorNames.push([given, family].filter(Boolean).join(' '));
  }
  if (authorNames.length) parts.push('Authors: ' + authorNames.join(', '));

  const journal = getValues(workNode, CONTAINER_TITLE);
  if (journal.length) parts.push('Journal: ' + journal.join('; '));

  const publisher = getValues(workNode, PUBLISHER);
  if (publisher.length) parts.push('Publisher: ' + publisher[0]);

  const issued = getValues(workNode, ISSUED);
  if (issued.length) parts.push('Published: ' + issued[0]);

  const type = getValues(workNode, WORK_TYPE_FIELD);
  if (type.length) parts.push('Type: ' + type[0]);

  const abstracts = getValues(workNode, ABSTRACT);
  if (abstracts.length) parts.push('Abstract: ' + abstracts.join(' '));

  return parts.join('\n');
}

/**
 * @function buildGrantEmbedText
 * @description Build a human-readable text representation of a grant for embedding.
 * Extracts name, funder, award ID, date interval, and total award amount from the
 * ae-std JSON-LD graph (VIVO ontology / schema.library.ucdavis.edu predicates).
 * @param {Array} graph - array of JSON-LD node objects from ae-std format
 * @returns {String} formatted text to feed into the embedding model
 */
function buildGrantEmbedText(graph) {
  const grantNode = graph.find(node => {
    const types = node['@type'] || [];
    return (Array.isArray(types) ? types : [types]).some(t =>
      t === GRANT_TYPE || t.startsWith(GRANT_TYPE_PREFIX)
    );
  });
  if (!grantNode) throw new Error('No grant node found in graph');

  const nodeMap = buildNodeMap(graph);
  const parts = [];

  const names = getValues(grantNode, GRANT_NAME);
  if (names.length) parts.push('Grant Title: ' + names.join('; '));

  // Funder (assignedBy references a FundingOrganization node)
  const assignedByRefs = grantNode[GRANT_ASSIGNED_BY] || [];
  const funderNames = [];
  for (const ref of (Array.isArray(assignedByRefs) ? assignedByRefs : [assignedByRefs])) {
    const funderNode = nodeMap.get(ref['@id'] || ref);
    if (funderNode) funderNames.push(...getValues(funderNode, GRANT_NAME));
  }
  if (funderNames.length) parts.push('Funder: ' + funderNames.join('; '));

  const awardIds = getValues(grantNode, GRANT_SPONSOR_AWARD_ID);
  if (awardIds.length) parts.push('Award ID: ' + awardIds.join('; '));

  // Date interval — the interval, start, and end are each separate referenced nodes
  const intervalRefs = grantNode[GRANT_DATE_TIME_INTERVAL] || [];
  for (const ref of (Array.isArray(intervalRefs) ? intervalRefs : [intervalRefs])) {
    const intervalNode = nodeMap.get(ref['@id'] || ref);
    if (!intervalNode) continue;

    const startRefs = intervalNode[GRANT_START] || [];
    for (const sRef of (Array.isArray(startRefs) ? startRefs : [startRefs])) {
      const startNode = nodeMap.get(sRef['@id'] || sRef);
      if (startNode) {
        const dt = getValues(startNode, GRANT_DATE_TIME);
        if (dt.length) parts.push('Start Date: ' + dt[0]);
      }
    }

    const endRefs = intervalNode[GRANT_END] || [];
    for (const eRef of (Array.isArray(endRefs) ? endRefs : [endRefs])) {
      const endNode = nodeMap.get(eRef['@id'] || eRef);
      if (endNode) {
        const dt = getValues(endNode, GRANT_DATE_TIME);
        if (dt.length) parts.push('End Date: ' + dt[0]);
      }
    }
  }

  const amounts = getValues(grantNode, GRANT_TOTAL_AWARD_AMOUNT);
  if (amounts.length) parts.push('Total Award Amount: ' + amounts[0]);

  return parts.join('\n');
}

/**
 * @function getLatestYearWeek
 * @description Find the latest year-week directory under /weekly in the cask.
 * Sorts the directory names (format YYYY-WW) lexicographically and returns the last.
 * @returns {Promise<String>} latest year-week string in YYYY-WW format
 */
async function getLatestYearWeek() {
  const listing = await cache.readdir('/weekly');
  const dirs = (listing.directories || [])
    .map(d => {
      if (typeof d === 'string') return path.basename(d);
      return d.name || d.dirname || (d.directory && path.basename(d.directory)) || null;
    })
    .filter(n => n && /^\d{4}-\d{2}$/.test(n));

  if (!dirs.length) throw new Error('No year-week directories found in /weekly');
  dirs.sort();
  return dirs[dirs.length - 1];
}

/**
 * @function embedDocument
 * @description Core embedding logic: checks the cask cache by text hash, calls Ollama if
 * the text has changed, writes the full raw result back to cask, then applies any
 * post-processing (clip/normalize) before returning.
 *
 * The cask always stores the full raw embedding. Post-processing is applied on the
 * way out so the cache is never polluted with a clipped or normalized variant.
 *
 * @param {String} ark - document ARK used as the cache key
 * @param {String} embedText - text to embed
 * @param {Object} opts options object
 * @param {String} opts.model - embedding model; defaults to config.llm.embedModel
 * @param {String} opts.host - ollama host; defaults to config.llm.host
 * @param {Number} opts.maxLength - clip embedding to this many dimensions after retrieval
 * @param {Boolean} opts.normalize - L2-normalize the embedding after retrieval
 * @returns {Promise<Object>} result with ark, hash, text, embedding, embedCachePath, cached
 */
async function embedDocument(ark, embedText, opts={}) {
  const embedModel = opts.model || config.llm.embedModel;
  const textHash = hashText(embedText);
  const embedCachePath = `/embed/${ark}/embed.json`;

  if (await cache.exists(embedCachePath)) {
    const cached = JSON.parse(await cache.read(embedCachePath));
    if (cached.hash === textHash) {
      logger.debug(`Embedding cache hit for ark=${ark}`);
      return { ...cached, embedding: postProcessVector(cached.embedding, opts), cached: true };
    }
    logger.debug(`Text changed for ark=${ark}, regenerating embedding`);
  }

  const { Ollama } = await import('@ucd-lib/experts-commons');
  const ollama = new Ollama({ host: opts.host, model: embedModel });
  const embedResp = await ollama.embed({ model: embedModel, input: embedText });

  // Store full raw embedding in cask — never clipped or normalized
  const result = {
    ark,
    hash: textHash,
    text: embedText,
    embedding: embedResp.embeddings[0],
    embedCachePath
  };

  await cache.write(embedCachePath, result);
  logger.debug(`Cached embedding for ark=${ark} at ${embedCachePath}`);

  return { ...result, embedding: postProcessVector(result.embedding, opts), cached: false };
}

/**
 * @function embedWork
 * @description Generate and cache an embedding for a work identified by ARK.
 *
 * Looks up the work file in the cask ae-std partition for the given year-week
 * (defaulting to the latest year-week found in /weekly), extracts text fields
 * via buildWorkEmbedText, and delegates to embedDocument for caching and Ollama.
 *
 * @param {String} ark - publication ARK, e.g. 'ark:/87287/d7mh2m/publication/2364120'
 * @param {Object} opts options object
 * @param {String} opts.yearWeek - year-week in YYYY-WW format; defaults to latest in cask
 * @param {String} opts.model - embedding model name; defaults to config.llm.embedModel
 * @param {String} opts.host - ollama host URL; defaults to config.llm.host
 * @param {Number} opts.maxLength - clip embedding to this many dimensions after retrieval
 * @param {Boolean} opts.normalize - L2-normalize the embedding after retrieval
 * @returns {Promise<Object>} result with ark, yearWeek, hash, text, embedding, embedCachePath, cached
 */
async function embedWork(ark, opts={}) {
  const yearWeek = opts.yearWeek || await getLatestYearWeek();

  logger.info(`Embedding work ark=${ark} yearWeek=${yearWeek}`);

  const rdfResp = await cache.caskFs.rdf.find({ subject: ark, partitionKeys: ['year-week-'+yearWeek, 'ae-std'] });
  if (!rdfResp?.results?.length) {
    throw new Error(`No work file found in cask for ark=${ark} yearWeek=${yearWeek}`);
  }

  const filePath = rdfResp.results[0].filepath;
  logger.debug(`Found work file for embedding at ${filePath}`);

  const parsed = JSON.parse(await cache.read(filePath));
  const graph = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);

  const embedText = buildWorkEmbedText(graph);
  const result = await embedDocument(ark, embedText, opts);
  return { ...result, yearWeek };
}

/**
 * @function embedGrant
 * @description Generate and cache an embedding for a grant identified by ARK.
 *
 * Looks up the grant file in the cask ae-std partition for the given year-week
 * (defaulting to the latest year-week found in /weekly), extracts text fields
 * via buildGrantEmbedText, and delegates to embedDocument for caching and Ollama.
 *
 * @param {String} ark - grant ARK
 * @param {Object} opts options object
 * @param {String} opts.yearWeek - year-week in YYYY-WW format; defaults to latest in cask
 * @param {String} opts.model - embedding model name; defaults to config.llm.embedModel
 * @param {String} opts.host - ollama host URL; defaults to config.llm.host
 * @param {Number} opts.maxLength - clip embedding to this many dimensions after retrieval
 * @param {Boolean} opts.normalize - L2-normalize the embedding after retrieval
 * @returns {Promise<Object>} result with ark, yearWeek, hash, text, embedding, embedCachePath, cached
 */
async function embedGrant(ark, opts={}) {
  const yearWeek = opts.yearWeek || await getLatestYearWeek();

  logger.info(`Embedding grant ark=${ark} yearWeek=${yearWeek}`);

  const rdfResp = await cache.caskFs.rdf.find({ subject: ark, partitionKeys: ['year-week-'+yearWeek, 'ae-std'] });
  if (!rdfResp?.results?.length) {
    throw new Error(`No grant file found in cask for ark=${ark} yearWeek=${yearWeek}`);
  }

  const filePath = rdfResp.results[0].filepath;
  logger.debug(`Found grant file for embedding at ${filePath}`);

  const parsed = JSON.parse(await cache.read(filePath));
  const graph = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);

  const embedText = buildGrantEmbedText(graph);
  const result = await embedDocument(ark, embedText, opts);
  return { ...result, yearWeek };
}

/**
 * @function computeExpertCentroid
 * @description Compute a centroid embedding for an expert from their work and grant embeddings.
 *
 * This is the "centroid embedding" approach: load each work/grant embedding from the cask
 * cache (raw, un-normalized vectors), compute the element-wise mean, then normalize the
 * result to unit length for dot_product similarity.
 *
 * NOTE ON APPROACH: The centroid is a single vector representing an expert's entire body
 * of work. It is effective for researchers with a focused research area but loses precision
 * for cross-disciplinary experts (the centroid may land between research clusters rather
 * than within any of them). Future alternatives to consider:
 *   - Weighted centroid (weight recent or favourite works more heavily)
 *   - Max-pooling per dimension (preserves multi-topic signals)
 *   - Multiple cluster embeddings per expert (one per research area)
 *
 * The raw embeddings are read directly from the cask cache. If an embedding does not yet
 * exist for a given ARK (e.g., the document was skipped during harvest), it is silently
 * omitted from the centroid.
 *
 * @param {Array<String>} arks - list of work and grant ARKs to include in the centroid
 * @param {Object} opts options object
 * @returns {Promise<Array<Number>|null>} normalized centroid vector, or null if no embeddings found
 */
async function computeExpertCentroid(arks, opts={}) {
  const vectors = [];

  for (const ark of arks) {
    const embedPath = `/embed/${ark}/embed.json`;
    if (!await cache.exists(embedPath)) {
      logger.debug(`No embedding cached for ark=${ark}, omitting from centroid`);
      continue;
    }
    const data = JSON.parse(await cache.read(embedPath));
    if (data.embedding && Array.isArray(data.embedding)) {
      vectors.push(data.embedding);
    }
  }

  if (!vectors.length) {
    logger.warn(`computeExpertCentroid: no embeddings found across ${arks.length} arks`);
    return null;
  }

  logger.info(`Computing expert centroid from ${vectors.length} of ${arks.length} embeddings`);

  const dim = Math.min(config.llm.embedDimension, vectors[0].length);
  const centroid = new Array(dim).fill(0);

  // Element-wise mean: divide inside the inner loop to limit floating point accumulation
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += vec[i] / vectors.length;
    }
  }

  // Normalize to unit length — required for dot_product similarity in Elasticsearch
  return normalizeVector(centroid);
}

export {
  embedWork,
  embedGrant,
  embedDocument,
  computeExpertCentroid,
  buildWorkEmbedText,
  buildGrantEmbedText,
  getLatestYearWeek,
  hashText,
  normalizeVector,
  clipVector,
  postProcessVector
};
export default embedWork;
