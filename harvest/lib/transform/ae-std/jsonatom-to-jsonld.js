import cache from '../../cache.js';
import { logger, config } from '@ucd-lib/experts-commons';
import path from 'path';

/**
 * @function jsonAtomToJsonLd
 * @description Converts JSONified Atom format from cdl to JSON-LD.
 * 
 * @param {String} jsonAtomFile - The path to the JSON Atom file on disk
 * @return {Promise<void>} - Resolves when the conversion is complete
 */
async function jsonAtomToJsonLd(jsonAtomFile) {
  let parts = path.parse(jsonAtomFile); // Ensure the file path is valid
  let jsonldFile = path.join(path.resolve(parts.dir, '..'), parts.name + '.jsonld');

  logger.info(`Converting JSON-Atom to JSON-LD: ${jsonAtomFile} -> ${jsonldFile}`);

  let atom = JSON.parse(await cache.read(jsonAtomFile));
  let graph = Object.assign({}, config.cdl.context);

  // Accept both Elements envelopes and object containers:
  // - v5.5: feed.entry[].api:object
  // - v6.13 users/publications/etc: api:response/api:result-list/api:result[].api:object
  // - v6.13 relationships: api:response/api:result-list/api:result[].api:relationship
  let objects = [];

  if (atom?.feed?.entry !== undefined) {
    let entries = atom.feed.entry || [];
    if (!Array.isArray(entries)) entries = [entries];
    objects = entries.map(e => e?.['api:object']).filter(Boolean);
  } else {
    let results = atom?.['api:response']?.['api:result-list']?.['api:result'] || [];
    if (!Array.isArray(results)) results = [results];

    // Prefer api:object when present; fall back to api:relationship for relationship endpoints
    objects = results
      .map(r => r?.['api:object'] || r?.['api:relationship'])
      .filter(Boolean);
  }

  graph['@graph'] = objects;

  await cache.write(jsonldFile, graph);

  return {jsonldFile, graph};
}

export default jsonAtomToJsonLd;