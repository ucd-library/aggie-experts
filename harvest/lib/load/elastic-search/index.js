import path from 'path';
import fs from 'fs/promises';
import { getWeek } from 'date-fns';
import getEsClient from '../../elastic-search-client.js';
import config from '../../config.js';
import logger from '../../logger.js';
import crypto from 'crypto';
import cache from '../../cache.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

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

/**
 * @function loadFiles
 * @description Load JSON files into Elasticsearch
 * @param {Array} files array of file paths to load
 */
async function loadFiles(files, alias) {
  if( !Array.isArray(files) ) {
    throw new Error('Files must be an array of file paths');
  }

  if( !Array.isArray(alias) ) {
    alias = [alias];
  }

  let indexes = {};

  for (const file of files) {
    let filename = path.parse(file).base;
    let parts = filename.split('.');
    // console.log({filename, parts});
    if( parts[0] !== 'webapp' ) {
      logger.info(`Skipping non-webapp file: ${filename}`);
      continue;
    }

    let index = '';
    if( parts[1] === 'expert' ) index = config.elasticsearch.indexes.experts;
    else if( parts[1] === 'work' ) index = config.elasticsearch.indexes.works;
    else if( parts[1] === 'grant' ) index = config.elasticsearch.indexes.grants;

    if( !index ) {
      logger.info(`Skipping index file: ${filename}`);
      continue;
    }

    let {json, sha256, md5, lastModified} = await loadFile(file);
    let id = json['@id'] || json.id || json._id;
    json._metadata = {
      file,
      sha256,
      md5,
      lastModified
    };

    for( let a of alias ) {
      let aliasIndex = `${index}-${a}`;
      logger.info(`Loading file=${file} into index=${aliasIndex} with id=${id}`);
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
  // const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  // const md5 = crypto.createHash('md5').update(content).digest('hex');
  const lastModified = metadata.modified;
  const json = JSON.parse(content);
  return {json, sha256, md5, lastModified};
}

/**
 * @function ensureCurrentIndexes
 * @description Ensure that the current and stage indexes exist in Elasticsearch
 * 
 * @returns {Promise}
 */
async function ensureCurrentIndexes() {
  let indexes = getCurrentIndexes();

  for (let baseName in indexes) {
    let { currentIndex, stageIndex,  currentAlias, stageAlias } = indexes[baseName];
    await createIndex(baseName, currentIndex);
    await createIndex(baseName, stageIndex);
    await ensureAlias(currentIndex, currentAlias);
    await ensureAlias(stageIndex, stageAlias);
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
 * @returns {Promise}
 */
async function setAlias(index, date, alias) {
  if( !alias.startsWith(index+'-') ) {
    alias = `${index}-${alias}`;
  }

  index = getIndexNameForDate(index, date);
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
  let current = new Date();
  let stage = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000); // one week from now

  let indexes = {};

  for( let baseIndexName in config.elasticsearch.indexes ) {
    let index = config.elasticsearch.indexes[baseIndexName];
    let currentIndex = getIndexNameForDate(index, current);
    let stageIndex = getIndexNameForDate(index, stage);
    indexes[baseIndexName] = {
      currentAlias: `${index}-${config.elasticsearch.aliases.current}`,
      stageAlias: `${index}-${config.elasticsearch.aliases.stage}`,
      base: index,
      currentIndex,
      stageIndex
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
function getIndexNameForDate(index, date) {
  let weekNumber, year;
  if( typeof date === 'string' ) {
    let parts = date.split('-');

    if( parts.length === 3 ) {
      parts.shift(); // assum index name was provided as part of the string
    }

    if( parts.length !== 2  ) {
      throw new Error('Date string must be in the format "year-week", e.g., "2023-37"');
    }
    year = parseInt(parts[0], 10);
    weekNumber = parseInt(parts[1], 10);
  } else if( date instanceof Date ) {
    weekNumber = getWeek(date, { weekStartsOn: 1 });
    year = date.getFullYear();
  } else {
    throw new Error('Date must be a string or Date object');
  }

  return `${index}-${year}-${weekNumber}`;
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

export {
  loadFiles,
  getIndexDocumentCount,
  createIndex,
  deleteIndex,
  ensureCurrentIndexes,
  setAlias,
  getCurrentIndexes,
  getIndexNameForDate,
  getState
}
