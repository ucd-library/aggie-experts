import fs from 'fs';
import path from 'path';
import getEsClient from '../../elastic-search-client.js';
import config from '../../config.js';
import logger from '../../logger.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

async function loadFiles(id, files) {
  // const results = [];
  // for (const file of files) {
  //   results.push(... (await loadFile(file))['@graph']);
  // }

  // const esClient = await getEsClient();
  // await esClient.index({
  //   index: config.elasticsearch.indexes.experts,
  //   id: id,
  //   body: {
  //     '@id': `info:fedora/${id}`,
  //     '@graph': results
  //   }
  // });

  // TEMP, should we handle multiple files? will need to identify expert vs work/grant
  const webappData = await loadFile(files[0]);
  const expertId = webappData['@id'];

  const esClient = await getEsClient();
  await esClient.index({
    index: config.elasticsearch.indexes.experts,
    id: expertId,
    body: {
      '@id': expertId,
      '@graph': webappData['@graph'],
      name: webappData.name,
      'is-visible': webappData['is-visible'],
      contactInfo: webappData.contactInfo,
      '@type': 'Expert'
    }
  });
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
    await esClient.indices.create({
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
