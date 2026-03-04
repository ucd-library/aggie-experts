import cache from '../cache.js';
import { logger } from '@ucd-lib/experts-commons';
import parser from 'xml2json';
import fs from 'fs-extra';

/**
 * @function xmlToJson
 * @description Converts XML to JSON format.
 * 
 * @param {String} xml - xml string
 * 
 * @return {Promise<void>} - Resolves when the conversion is complete
 */
async function xmlToJson(xml) {
  logger.info(`Converting XML to JSON`);
  let json = parser.toJson(xml, {object: true});
  return json;
}

export default xmlToJson;