import PgClient from "../pg-client.js";
import config from "../config.js";
import { fileURLToPath } from "url";
import path from "path";
import logger from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaFile = path.join(__dirname, 'additional-schema.sql');

async function init() {
  logger.info('Initializing additional Aggie Experts Dagster database schema...');

  let dgConfig = Object.assign({}, config.postgres);
  dgConfig.database = config.dagster.databaseName;
  const pgClient = new PgClient(dgConfig, 'public');
  await pgClient.connect();
  await pgClient.queryFromFile(schemaFile);
  await pgClient.end();
}

export {init};