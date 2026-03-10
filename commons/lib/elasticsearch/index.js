import searchTemplates from './search-templates/index.js';
import pipelines from './pipelines/index.js';

import path from 'path';
import fs from 'fs/promises';
import { 
  getYearWeek, 
  getTodaysDate, 
  isPlainDate
} from '../year-week.js';
import getEsClient from './client.js';
import config from '../config.js';
import { logger } from '../logger.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);


class ElasticsearchWrapper {

  constructor() {
    this.client = null;
    this.searchTemplates = searchTemplates;
    this.pipelines = pipelines;
  }

  async initClient() {
    if( this.client ) {
      return this.client;
    }
    this.client = await getEsClient();
    return this.client;
  }

  /**
   * @function insert
   * @description insert a document into elasticsearch
   * 
   * @param {String} index index to insert into
   * @param {String} id document id
   * @param {Object} body document body
   * @returns {Promise} Elasticsearch response
   */
  async insert(index, id, body) {
    await this.initClient();
    if( body._id ) {
      delete body._id;
    }

    return this.client.index({
      index: index,
      id: id,
      body: body
    });
  }

  async deleteDocument(index, id) {
    await this.initClient();

    try {
      return await this.client.delete({
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

  /**
   * @function ensureCurrentIndexes
   * @description Ensure that the current index exists and that current and stage aliases are set
   * 
   * @returns {Promise}
   */
  async ensureCurrentIndexes() {
    let indexes = this.getCurrentIndexes();

    for (let baseName in indexes) {
      let { currentIndex,  currentAlias, stageAlias } = indexes[baseName];
      await this.createIndex(baseName, currentIndex);
      // await createIndex(baseName, stageIndex);
      await this.ensureAlias(currentIndex, currentAlias);
      await this.ensureAlias(currentIndex, stageAlias);
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
  async setAlias(index, date, alias, version) {
    if( !alias.startsWith(index+'-') ) {
      alias = `${index}-${alias}`;
    }

    index = this.getIndexNameForDate(index, date, version);
    logger.info(`Setting alias ${alias} to point to index ${index}`);
    await this.initClient();

    const aliasExists = await this.client.indices.existsAlias({ name: alias });
    let alreadySet = false;

    if (aliasExists) {
      const currentAliases = await this.client.indices.getAlias({ name: alias });
      const currentIndexes = Object.keys(currentAliases);
      for (const currentIndex of currentIndexes) {
        if (currentIndex === index) {
          alreadySet = true;
          continue;
        }
        logger.info(`Removing alias ${alias} from index ${currentIndex}`);
        await this.client.indices.deleteAlias({ index: currentIndex, name: alias });
      }
    }

    if (alreadySet) {
      logger.info(`Alias ${alias} is already set to index ${index}, no changes made.`);
      return;
    }

    logger.info(`Adding alias ${alias} to index ${index}`);
    await this.client.indices.putAlias({ index: index, name: alias });
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
  async ensureAlias(index, alias) {
    await this.initClient();

    const aliasExists = await this.client.indices.existsAlias({ name: alias });
    if (aliasExists) return;

    logger.info(`Adding alias ${alias} to index ${index}`);
    await this.client.indices.putAlias({ index: index, name: alias });
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
  async createIndex(baseName, date) {
    let indexNames = Object.keys(config.elasticsearch.indexes);
    if( !indexNames.includes(baseName) ) {
      throw new Error(`Unknown base index name: ${baseName}. Known indexes: ${indexNames.join(', ')}`);
    }

    const indexName = this.getIndexNameForDate(baseName, date);
    logger.info(`Initializing Elasticsearch schema for index: ${indexName}`);

    await this.initClient();
    const schema = JSON.parse(await fs.readFile(path.join(__dirname, 'experts-schema.json'), 'utf8'));

    const indexExists = await this.client.indices.exists({ 
      index: indexName
    });
    if (!indexExists) {
      logger.info(`Creating index: ${indexName}`);
      await this.client.indices.create({
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
  async deleteIndex(index, date) {
    index = this.getIndexNameForDate(index, date);
    logger.info(`Deleting Elasticsearch index: ${index}`);

    await this.initClient();

    const indexExists = await this.client.indices.exists({ index });
    if (indexExists) {
      logger.info(`Deleting index: ${index}`);
      await this.client.indices.delete({ index });
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
  getCurrentIndexes() {
    let current = getTodaysDate();
    // let stage = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000); // one week from now

    let indexes = {};

    for( let baseIndexName in config.elasticsearch.indexes ) {
      let index = config.elasticsearch.indexes[baseIndexName];
      let currentIndex = this.getIndexNameForDate(index, current);
      // let stageIndex = this.getIndexNameForDate(index, stage);
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
  getIndexNameForDate(index, date, version) {
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
      version = config.getBuildVersion();
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
  async copyIndex(sourceIndex, destIndex, opts={}) {
    await this.initClient();
    await this.client.reindex({
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
  async getState() {
    // get the current indexes and aliases
    await this.initClient();
    const indexes = await this.client.cat.indices({ format: 'json' });
    let aliases = await this.client.cat.aliases({ format: 'json' });

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

  async getIndexDocumentCount(index) {
    await this.initClient();
    const resp = await this.client.count({ index });
    return resp.count;
  }

  async ensureSearchScript(opts={}) {
    let template = this.searchTemplates[opts.template || opts.id];

    if( !template ) {
      throw new Error(`Search template not found: ${opts.template || opts.id}`);
    }

    if ( !template.id || !template.script) {
      throw new Error(`Invalid template structure: missing id or script property`);
    }

    if( !opts.replace ) {
      let exists = await this.searchTemplateExists(template.id);
      if( exists ) {
        logger.info(`Search template with id ${template.id} already exists. Use replace flag to overwrite.`);
        return;
      }
    }
    
    await this.deleteSearchScript(template.id);
    await this.loadSearchScript(template.id, template.script);

    logger.info(`Successfully loaded search template: ${template.id}`);
  }

  /**
   * @function deleteSearchScript
   * @description Delete a stored script from Elasticsearch
   * 
   * @param {String} scriptId - The ID of the script to delete
   * @returns {Promise}
   */
  async deleteSearchScript(scriptId) {
    logger.info(`Deleting search script: ${scriptId}`);
    await this.initClient();

    try {
      await this.client.deleteScript({ id: scriptId });
      logger.info(`Successfully deleted search script: ${scriptId}`);
    } catch (error) {
      if (error.statusCode === 404) {
        logger.info(`Search script does not exist: ${scriptId}, nothing to delete.`);
      } else {
        throw error;
      }
    }
  }

  async searchTemplateExists(templateId) {
    await this.initClient();
    try {
      await this.client.getScript({ id: templateId });
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
  async loadSearchScript(scriptId, scriptBody) {
    logger.info(`Loading search script: ${scriptId}`);
    await this.initClient();

    await this.client.putScript({
      id: scriptId,
      body: {
        script: scriptBody
      }
    });
    
    logger.info(`Successfully loaded search script: ${scriptId}`);
  }

  async ensurePipeline(opts={}) {
    let pipeline = this.pipelines[opts.pipeline || opts.id];
    
    if( !pipeline ) {
      throw new Error(`Pipeline not found: ${opts.pipeline || opts.id}`);
    }
    if ( !pipeline.id || !pipeline.body) {
      throw new Error(`Invalid pipeline structure: missing id or body property`);
    }

    if( !opts.replace ) {
      let exists = await this.searchPipelineExists(pipeline.id);
      if( exists ) {
        logger.info(`Ingest pipeline with id ${pipeline.id} already exists. Use replace flag to overwrite.`);
        return;
      }
    }

    await this.deletePipeline(pipeline.id);
    await this.loadPipeline(pipeline.id, pipeline.body);

    logger.info(`Successfully loaded ingest pipeline: ${pipeline.id}`);
  }

  async searchPipelineExists(pipelineId) {
    await this.initClient();
    try {
      await this.client.ingest.getPipeline({ id: pipelineId });
      return true;
    } catch (error) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async deletePipeline(pipelineId) {
    logger.info(`Deleting ingest pipeline: ${pipelineId}`);
    await this.initClient();

    try {
      await this.client.ingest.deletePipeline({ id: pipelineId });
      logger.info(`Successfully deleted ingest pipeline: ${pipelineId}`);
    } catch (error) {
      if (error.statusCode === 404) {
        logger.info(`Ingest pipeline does not exist: ${pipelineId}, nothing to delete.`);
      } else {
        throw error;
      }
    }
  }

  async loadPipeline(pipelineId, pipelineBody) {
    logger.info(`Loading ingest pipeline: ${pipelineId}`);
    await this.initClient();

    await this.client.ingest.putPipeline({
      id: pipelineId,
      body: pipelineBody
    });
    
    logger.info(`Successfully loaded ingest pipeline: ${pipelineId}`);
  }
}

const Elasticsearch = new ElasticsearchWrapper();
export { Elasticsearch, getEsClient };