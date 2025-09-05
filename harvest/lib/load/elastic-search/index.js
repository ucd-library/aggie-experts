import fs from 'fs';
import path from 'path';
import getEsClient from '../../elastic-search-client.js';
import config from '../../config.js';
import logger from '../../logger.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

async function insert(index, id, body) {
  const esClient = await getEsClient();
  return esClient.index({
    index: index,
    id: id,
    body: body
  });
}

async function loadFiles(files) {
  for (const file of files) {
    let filename = path.parse(file).base;
    let parts = filename.split('.');
    console.log({filename, parts});
    if( parts[0] !== 'webapp' ) {
      logger.info(`Skipping non-webapp file: ${filename}`);
      continue;
    }
     
    let index = '';
    if( parts[1] === 'expert' ) index = config.elasticsearch.indexes.experts;

    if( !index ) {
      logger.info(`Skipping index file: ${filename}`);
      continue;
    }

    let contents = await loadFile(file);
    let id = contents['@id'] || contents.id || contents._id;
    logger.info(`Loading file=${filename} into index=${index} with id=${id}`);

    await insert(index, id, contents);
  }
}

async function loadFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`File does not exist: ${file}`);
  }
  const content = fs.readFileSync(file, 'utf-8');
  const json = JSON.parse(content);
  return json;
}

async function initSchema() {
  const esClient = await getEsClient();

  const schema = await loadFile(path.join(__dirname, 'experts-schema.json'));

  const indexExists = await esClient.indices.exists({ index: config.elasticsearch.indexes.experts });
  if (!indexExists) {
    logger.info(`Creating index: ${config.elasticsearch.indexes.experts}`);
    await esClient.indices.create({ index: config.elasticsearch.indexes.experts });

    await esClient.indices.putMapping({
      index: config.elasticsearch.indexes.experts,
      body: schema
    });
  } else {
    logger.info(`Index already exists: ${config.elasticsearch.indexes.experts}, no schema changes applied.`); 
  }
}

async function deleteSchema() {
  const esClient = await getEsClient();
  const index = config.elasticsearch.indexes.experts;

  const indexExists = await esClient.indices.exists({ index });
  if (indexExists) {
    logger.info(`Deleting index: ${index}`);
    await esClient.indices.delete({ index });
  } else {
    logger.info(`Index does not exist: ${index}, nothing to delete.`);
  }
}

export {
  loadFiles,
  initSchema,
  deleteSchema
}
