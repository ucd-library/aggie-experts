import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { getYearWeek, getTodaysDate, isPlainDate } from '@ucd-lib/experts-commons';
import { Temporal } from '@js-temporal/polyfill';
import getEsClient from '../../elastic-search-client.js';
import { config, logger } from '@ucd-lib/experts-commons';
import cache from '../../cache.js';
import { getNodeByType, SHORT_TYPES } from '../../transform/utils.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SEARCH_TEMPLATE_DIR = path.join(__dirname, '../../../../webapp/models/search/template');

/**
 * @function insert
 * @description insert a document into elasticsearch
 * 
 * @param {String} index index to insert into
 * @param {String} id document id
 * @param {Object} body document body
 * @returns {Promise} Elasticsearch response
 */
async function insert(index, id, body) {
  if( body._id ) {
    delete body._id;
  }

  const esClient = await getEsClient();
  return esClient.index({
    index: index,
    id: id,
    body: body
  });
}

async function deleteDocument(index, id) {
  const esClient = await getEsClient();

  try {
    return await esClient.delete({
      index: index,
      id: id
    });
  } catch (error) {
    if (error.statusCode === 404) {
      logger.info(`Document not found for delete: index=${index}, id=${id}`);
      return error?.meta?.body;
    }
    throw error;
  }
}

async function getMetadata(index, id) {
  const esClient = await getEsClient();
  try {
    const resp = await esClient.get({
      index: index,
      id: id,
      _source: ['_metadata']
    });
    if( resp._source?._metadata ) {
      return {
        metadata: resp._source._metadata,
        index: resp._index
      }
    }
  } catch (error) {}
  return null;
}

/**
 * @function loadFiles
 * @description Load JSON files into Elasticsearch
 * @param {Array} files array of file paths to load
 */
async function loadFiles(files, alias) {
  if( !Array.isArray(alias) ) {
    alias = [alias];
  }

  let indexes = {};

  for (const file of files) {

    let index = '';
    if( file.type === 'expert' ) index = config.elasticsearch.indexes.experts;
    else if( file.type === 'work' ) index = config.elasticsearch.indexes.works;
    else if( file.type === 'grant' ) index = config.elasticsearch.indexes.grants;

    if( !index ) {
      logger.info(`Skipping index file: ${file.path} with unknown type: ${file.type}`);
      continue;
    }

    let {json, sha256, md5, lastModified} = await loadFile(file.path);
    let id = json['@id'] || json.id || json._id;
    json._metadata = {
      file: file.path,
      sha256,
      md5,
      lastModified
    };

    for( let a of alias ) {
      let aliasIndex = `${index}-${a}`;

      let metadataResp = await getMetadata(aliasIndex, id);
      if( metadataResp && metadataResp.metadata.sha256 === sha256 ) {
        logger.info(`Skipping file=${file.path} for alias=${aliasIndex}, index=${metadataResp.index} with id=${id} - no changes detected`);
        if( !indexes[aliasIndex] ) {
          indexes[aliasIndex] = metadataResp.index;
        }
        continue;
      }

      logger.info(`Loading file=${file.path} into index=${aliasIndex} with id=${id}`);
      let resp = await insert(aliasIndex, id, json);
      if( !indexes[aliasIndex] ) {
        indexes[aliasIndex] = resp._index;
      }
    }
  }

  return indexes;
}

/**
 * @function loadFile
 * @description Load a single JSON file
 * 
 * @param {String} file full path to the JSON file
 * @returns {Promise} JSON content of the file
 */
async function loadFile(file) {
  if (!await cache.exists(file)) {
    throw new Error(`File does not exist: ${file}`);
  }
  const content = await cache.read(file);
  const metadata = await cache.getFileStats(file);
  const sha256 = metadata.digests.sha256;
  const md5 = metadata.digests.md5;
  const lastModified = metadata.modified;
  const json = JSON.parse(content);
  return {json, sha256, md5, lastModified};
}

/**
 * @function ensureCurrentIndexes
 * @description Ensure that the current index exists and that current and stage aliases are set
 * 
 * @returns {Promise}
 */
async function ensureCurrentIndexes() {
  let indexes = getCurrentIndexes();

  for (let baseName in indexes) {
    let { currentIndex,  currentAlias, stageAlias } = indexes[baseName];
    await createIndex(baseName, currentIndex);
    // await createIndex(baseName, stageIndex);
    await ensureAlias(currentIndex, currentAlias);
    await ensureAlias(currentIndex, stageAlias);
  }

  return indexes;
}

/**
 * @function setAlias
 * @description Set an alias to point to a specific index, removing it from any other indexes
 * 
 * @param {String} index index base name to point the alias to 
 * @param {Date|String} date Date object or string in the format "weekNumber-year" (e.g., "37-2023") to suffix the index name
 * @param {String} alias alias name to set
 * @param {String} version optional version string to suffix the index name.  If not provided, defaults to the current build version.
 * 
 * @returns {Promise}
 */
async function setAlias(index, date, alias, version) {
  if( !alias.startsWith(index+'-') ) {
    alias = `${index}-${alias}`;
  }

  index = getIndexNameForDate(index, date, version);
  logger.info(`Setting alias ${alias} to point to index ${index}`);
  const esClient = await getEsClient();

  const aliasExists = await esClient.indices.existsAlias({ name: alias });
  let alreadySet = false;

  if (aliasExists) {
    const currentAliases = await esClient.indices.getAlias({ name: alias });
    const currentIndexes = Object.keys(currentAliases);
    for (const currentIndex of currentIndexes) {
      if (currentIndex === index) {
        alreadySet = true;
        continue;
      }
      logger.info(`Removing alias ${alias} from index ${currentIndex}`);
      await esClient.indices.deleteAlias({ index: currentIndex, name: alias });
    }
  }

  if (alreadySet) {
    logger.info(`Alias ${alias} is already set to index ${index}, no changes made.`);
    return;
  }

  logger.info(`Adding alias ${alias} to index ${index}`);
  await esClient.indices.putAlias({ index: index, name: alias });
}

/**
 * @function ensureAlias
 * @description Ensure that an alias exists for a given index. 
 * If the alias already exists, do nothing.
 * 
 * @param {String} index 
 * @param {String} alias 
 * @returns {Promise}
 */
async function ensureAlias(index, alias) {
  const esClient = await getEsClient();

  const aliasExists = await esClient.indices.existsAlias({ name: alias });
  if (aliasExists) return;

  logger.info(`Adding alias ${alias} to index ${index}`);
  await esClient.indices.putAlias({ index: index, name: alias });
}

/**
 * @function createIndex
 * @description Create an Elasticsearch index with the appropriate schema
 * 
 * @param {String} baseName base name of the index (e.g., 'experts', 'works') 
 * @param {Date|String} date Date object or string in the format "weekNumber-year" (e.g., "37-2023") to suffix the index name 
 * 
 * @returns {Promise}
 */
async function createIndex(baseName, date) {
  let indexNames = Object.keys(config.elasticsearch.indexes);
  if( !indexNames.includes(baseName) ) {
    throw new Error(`Unknown base index name: ${baseName}. Known indexes: ${indexNames.join(', ')}`);
  }

  const indexName = getIndexNameForDate(baseName, date);
  logger.info(`Initializing Elasticsearch schema for index: ${indexName}`);

  const esClient = await getEsClient();
  const schema = JSON.parse(await fs.readFile(path.join(__dirname, 'experts-schema.json'), 'utf8'));

  const indexExists = await esClient.indices.exists({ 
    index: indexName
  });
  if (!indexExists) {
    logger.info(`Creating index: ${indexName}`);
    await esClient.indices.create({
      index: indexName,
      body: schema
    });
  } else {
    logger.info(`Index already exists: ${indexName}, no schema changes applied.`);
  }
}

/**
 * @function deleteIndex
 * @description Delete an Elasticsearch index
 * 
 * @param {String} index index name to delete
 * @returns {Promise}
 */
async function deleteIndex(index, date) {
  index = getIndexNameForDate(index, date);
  logger.info(`Deleting Elasticsearch index: ${index}`);

  const esClient = await getEsClient();

  const indexExists = await esClient.indices.exists({ index });
  if (indexExists) {
    logger.info(`Deleting index: ${index}`);
    await esClient.indices.delete({ index });
  } else {
    logger.info(`Index does not exist: ${index}, nothing to delete.`);
  }
}

/**
 * @function getCurrentIndexes
 * @description Get the current and stage indexes based on the current (today's) date
 * 
 * @returns {Object} - An object containing the current and stage indexes
 */
function getCurrentIndexes() {
  let current = getTodaysDate();
  // let stage = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000); // one week from now

  let indexes = {};

  for( let baseIndexName in config.elasticsearch.indexes ) {
    let index = config.elasticsearch.indexes[baseIndexName];
    let currentIndex = getIndexNameForDate(index, current);
    // let stageIndex = getIndexNameForDate(index, stage);
    indexes[baseIndexName] = {
      currentAlias: `${index}-${config.elasticsearch.aliases.current}`,
      stageAlias: `${index}-${config.elasticsearch.aliases.stage}`,
      base: index,
      currentIndex
      // stageIndex
    }
  }

  return indexes;
}

/**
 * @function getIndexNameForDate
 * @description Get the index name for a given base index and date.
 *
 * @param {String} index - The base index name (e.g., 'experts', 'works')
 * @param {Date|String} date - The date for which to get the index name. Can be a Date object or a string in the format "weekNumber-year" (e.g., "37-2023").
 * @returns {String} - The formatted index name
 */
function getIndexNameForDate(index, date, version) {
  let weekNumber, year;

  if( typeof date === 'string' ) {
    let parts = date.split('-');

    if( parts.length > 3 ) {
      parts.shift(); // assum index name was provided as part of the string
    }

    if( parts.length < 2 ) {
      throw new Error('Date string must be in the format "year-week", e.g., "2023-37"');
    }
    year = parts.shift();
    weekNumber = parts.shift();
  } else if( isPlainDate(date) ) {
    [year, weekNumber] = getYearWeek({date}).split('-');
  } else {
    throw new Error('Date must be a string or Temporal.PlainDate object');
  }

  let parts = [index, year, weekNumber];

  if( version === undefined || version === null ) {
    version = getBuildVersion();
  }

  if( version ) {
    parts.push(version);
  }

  return parts.join('-');
}

/**
 * @function copyIndex
 * 
 * @description Copy an Elasticsearch index to a new index.  This is useful for reindexing with a new schema, 
 * or copying data from stage to current indexes.
 * 
 * @param {String} sourceIndex 
 * @param {String} destIndex
 * @param {Object} opts 
 * @param {Boolean} opts.waitForCompletion - If true, will wait for the reindex operation to complete before returning.  Defaults to false, which will return immediately after starting the reindex operation.
 * @param {Boolean} opts.refresh - If true, will refresh the destination index after the reindex operation is complete to make the new documents searchable immediately.  Defaults to true.
 * 
 */
async function copyIndex(sourceIndex, destIndex, opts={}) {
  const esClient = await getEsClient();
  await esClient.reindex({
    body: {
      source: {
        index: sourceIndex
      },
      dest: {
        index: destIndex
      }
    },
    wait_for_completion: opts.waitForCompletion || false,
    refresh: opts.refresh || true
  });
}


/**
 * @function getState
 * @description Get the current state of indexes and aliases in Elasticsearch
 * 
 * @return {Promise}
 */
async function getState() {
  // get the current indexes and aliases
  const esClient = await getEsClient();
  const indexes = await esClient.cat.indices({ format: 'json' });
  let aliases = await esClient.cat.aliases({ format: 'json' });

  aliases = aliases.filter(a => {
    let isAE = false;
    for( let index of indexes ) {
      if( index.index === a.index ) {
        isAE = true;
        break;
      }
    }
    return isAE;
  });

  return { indexes, aliases };
}

async function getIndexDocumentCount(index) {
  const esClient = await getEsClient();
  const resp = await esClient.count({ index });
  return resp.count;
}

async function ensureSearchScript(opts={}) {
  let templateName = opts.template || 'complete';
  let templatePath = path.resolve(SEARCH_TEMPLATE_DIR, `${templateName}.js`);
  if( !existsSync(templatePath) ) {
    throw new Error(`Template file not found: ${templatePath}`);
  }
  logger.info(`Loading search template from ${templatePath}...`);

  let template = (await import(templatePath)).default;

  // let template = eval(`(${templateMatch[1]})`);
  if (!template || !template.id || !template.script) {
    throw new Error(`Invalid template structure: missing id or script property`);
  }

  if( !opts.replace ) {
    let exists = await searchTemplateExists(template.id);
    if( exists ) {
      logger.info(`Search template with id ${template.id} already exists. Use replace flag to overwrite.`);
      return;
    }
  }
  
  await deleteSearchScript(template.id);
  await loadSearchScript(template.id, template.script);

  logger.info(`Successfully loaded search template: ${template.id}`);
}

/**
 * @function deleteSearchScript
 * @description Delete a stored script from Elasticsearch
 * 
 * @param {String} scriptId - The ID of the script to delete
 * @returns {Promise}
 */
async function deleteSearchScript(scriptId) {
  logger.info(`Deleting search script: ${scriptId}`);
  const esClient = await getEsClient();
  
  try {
    await esClient.deleteScript({ id: scriptId });
    logger.info(`Successfully deleted search script: ${scriptId}`);
  } catch (error) {
    if (error.statusCode === 404) {
      logger.info(`Search script does not exist: ${scriptId}, nothing to delete.`);
    } else {
      throw error;
    }
  }
}

async function searchTemplateExists(templateId) {
  const esClient = await getEsClient();
  try {
    await esClient.getScript({ id: templateId });
    return true;
  } catch (error) {
    if (error.statusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * @function loadSearchScript
 * @description Load a stored script into Elasticsearch
 * 
 * @param {String} scriptId - The ID for the script
 * @param {Object} scriptBody - The script body object with lang and source properties
 * @returns {Promise}
 */
async function loadSearchScript(scriptId, scriptBody) {
  logger.info(`Loading search script: ${scriptId}`);
  const esClient = await getEsClient();
  
  await esClient.putScript({
    id: scriptId,
    body: {
      script: scriptBody
    }
  });
  
  logger.info(`Successfully loaded search script: ${scriptId}`);
}

async function getUsersCurrentScholarlyWorks(expertId, type, alias='stage') {
  const esClient = await getEsClient();
  const index = type+'s-'+config.elasticsearch.aliases[alias];
  const resp = await esClient.search({
    index,
    body: {
        "query": {
        "nested": {
          "path": "@graph",
          "query": {
            "term": {
              "@graph.@id": expertId
            }
          }
        }
      },
      _source: ["@graph.@id", "@graph.type", "@graph.@type"] // Only return the @id field
    },
    size: 10000 // adjust as needed, consider using scroll API for large datasets
  });

  return resp.hits.hits
    .map(hit => hit._source['@graph'])
    .flat()
    .filter(node => node['@id'])
    .filter(node => getNodeByType(node, SHORT_TYPES.SCHOLARLY_WORK_TYPES) )
    .map(node => node['@id']);
}

function getBuildVersion() {
  let build = config.buildInfo.harvest || config.buildInfo.webapp || {};
  return build.tag || build.branch || 'unknown';
}

export {
  deleteDocument,
  loadFiles,
  getIndexDocumentCount,
  createIndex,
  deleteIndex,
  copyIndex,
  getBuildVersion,
  ensureCurrentIndexes,
  setAlias,
  getCurrentIndexes,
  getIndexNameForDate,
  getState,
  ensureSearchScript,
  deleteSearchScript,
  loadSearchScript,
  searchTemplateExists,
  getUsersCurrentScholarlyWorks
}
