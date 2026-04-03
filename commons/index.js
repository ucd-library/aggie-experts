import { Elasticsearch, getEsClient } from './lib/elasticsearch/index.js';
import { logger, logReqMiddleware, createLogger } from './lib/logger.js';
import GoogleSecret from './lib/google-secret.js';
import config from './lib/config.js';
import { getYearWeek, getTodaysDate, isPlainDate, parseYearWeek } from './lib/year-week.js';
import ElementsClient from './lib/elements-client.js';
import ExpertsKcAdminClient from './lib/keycloak-admin.js';
import PgClient from './lib/pg-client.js';
import Ollama from './lib/ollama.js';

export {
  Ollama,
  PgClient,
  ExpertsKcAdminClient,
  ElementsClient,
  Elasticsearch,
  getEsClient,
  logger,
  logReqMiddleware,
  createLogger,
  GoogleSecret,
  config,
  getYearWeek,
  getTodaysDate,
  isPlainDate,
  parseYearWeek
};