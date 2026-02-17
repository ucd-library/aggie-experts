import cache from '../../cache.js';
import logger from '../../logger.js';
import config from '../../config.js';

/**
 * @function iamApiToJsonLd
 * @description Converts IAM API response to JSON-LD.
 *
 * @param {String} jsonFile - The path to the json response file on disk
 * @return {Promise<void>} - Resolves when the conversion is complete
 */
async function iamApiToJsonLd(jsonFile) {
  let jsonldFile = jsonFile.replace(/\.json$/, '.jsonld');
  logger.info(`Converting IAM API response to JSON-LD: ${jsonFile} -> ${jsonldFile}`);

  let res = JSON.parse(await cache.read(jsonFile));

  let graph = {
    ... config.iam.context,
    "@id" : 'ark:/87287/d7c08j/',
    "@graph" : res.responseData.results || []
  };

  await cache.write('iam-to-jsonld-transform', jsonldFile, graph);

  return {jsonldFile, graph};
}

export default iamApiToJsonLd;
