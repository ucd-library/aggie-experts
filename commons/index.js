import { Elasticsearch, getEsClient } from './lib/elasticsearch/index.js';
import { logger, logReqMiddleware, createLogger } from './lib/logger.js';
import GoogleSecret from './lib/google-secret.js';
import config from './lib/config.js';
import { getYearWeek, getTodaysDate, isPlainDate } from './lib/year-week.js';
import ElementsClient from './lib/elements-client.js';
import ExpertsKcAdminClient from './lib/keycloak-admin.js';
import searchTemplate from './lib/elasticsearch/search-templates/complete.js';


export {
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
  searchTemplate
};