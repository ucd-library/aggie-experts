import cache from '../cache.js';
import logger from '../logger.js';
import parser from 'xml2json';
import fs from 'fs-extra';

/**
 * @function xmlToJson
 * @description Converts XML files to JSON format.
 * 
 * @param {String} xmlFile - The path to the XML file on disk
 * 
 * @return {Promise<void>} - Resolves when the conversion is complete
 */
async function xmlToJson(xmlFile) {
  let jsonFile = xmlFile.replace(/\.xml$/, '.json');
  logger.info(`Converting XML to JSON: ${xmlFile} -> ${jsonFile}`);

  if( !fs.existsSync(xmlFile) ) {
    throw new Error(`XML file not found: ${xmlFile}`);
  }

  let xml = await fs.readFile(xmlFile, 'utf8');
  let json = parser.toJson(xml, {object: true});

  cache.write(jsonFile, json);

  return json;
}

export default xmlToJson;