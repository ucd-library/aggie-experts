import { searchTemplate } from './lib/elasticsearch/index.js';
import logger from './lib/logger.js';
import GoogleSecret from './lib/google-secret.js';
import config from './lib/config.js';
import { getYearWeek, getTodaysDate } from './lib/year-week.js';
import ElementsClient from './lib/elements-client.js';
import ExpertsKcAdminClient from './lib/keycloak-admin.js';


export {
  ExpertsKcAdminClient,
  ElementsClient,
  searchTemplate,
  logger,
  GoogleSecret,
  config,
  getYearWeek,
  getTodaysDate
};