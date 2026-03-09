import path from 'path';
import fs from 'fs/promises';
import { 
  getYearWeek, 
  getTodaysDate, 
  isPlainDate, 
  searchTemplate 
} from '@ucd-lib/experts-commons';
import getEsClient from '../../elastic-search-client.js';
import { config, logger } from '@ucd-lib/experts-commons';
import cache from '../../cache.js';
import { getNodeByType, SHORT_TYPES } from '../../transform/utils.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

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

async function getUsersCurrentScholarlyWorks(expertId, type, alias) {
  if( !alias ) alias = config.elasticsearch.aliases.stage;
  const esClient = await getEsClient();
  const index = type+'s-'+alias;
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
  loadFiles,
  getBuildVersion,
  getUsersCurrentScholarlyWorks
}
