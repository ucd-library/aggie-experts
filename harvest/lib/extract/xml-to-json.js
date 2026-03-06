import cache from '../cache.js';
import { logger } from '@ucd-lib/experts-commons';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs-extra';

// Configure fast-xml-parser to mimic xml2json's default object output as closely as possible.
// Key compatibility goals:
// - attributes are plain properties (no @_, no separate group)
// - mixed-content text node name is $t (xml2json's alternateTextNode default)
// - trim text values
// - keep element text values as strings (xml2json's output in this pipeline)
//
// IMPORTANT:
// Elements uses lots of numeric-looking *identifier* attributes (eg record id="10847425").
// Downstream JSON-LD code expects identifiers to remain strings (not numbers), so we
// intentionally DO NOT coerce attribute values.
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  attributesGroupName: false,

  // xml2json uses "$t" for text when there are also attributes/children.
  textNodeName: '$t',

  // xml2json trim:true
  trimValues: true,

  // Keep *all* values as strings to match legacy xml2json output.
  // (Downstream code can coerce when needed; JSON-LD framing is sensitive to numeric ids.)
  parseTagValue: false,
  parseAttributeValue: false,

  // Keep namespaces/prefixes in tag names (eg api:response)
  removeNSPrefix: false,

  allowBooleanAttributes: true,
});

/**
 * @function xmlToJson
 * @description Converts XML to JSON format.
 * 
 * @param {String} xml - xml string
 * 
 * @return {Promise<Object>} - Parsed XML as a JS object
 */
async function xmlToJson(xml) {
  logger.info(`Converting XML to JSON`);
  return xmlParser.parse(xml);
}

export default xmlToJson;