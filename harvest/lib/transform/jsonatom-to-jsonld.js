import cache from '../cache.js';
import logger from '../logger.js';
import config from '../config.js';
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
  graph['@graph'] = atom.feed.entry || [];

  cache.write('jsonatom-to-jsonld-transform', jsonldFile, graph);

  return {jsonldFile, graph};
}

export default jsonAtomToJsonLd;