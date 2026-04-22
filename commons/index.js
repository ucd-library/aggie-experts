import { Elasticsearch, getEsClient } from './lib/elasticsearch/index.js';
import { logger, logReqMiddleware, createLogger } from './lib/logger.js';
import GoogleSecret from './lib/google-secret.js';
import config from './lib/config.js';
import { getYearWeek, getTodaysDate, isPlainDate, parseYearWeek } from './lib/year-week.js';
import ElementsClient from './lib/elements-client.js';
import ExpertsKcAdminClient from './lib/keycloak-admin.js';
import {
  patchExpertVisibility,
  deleteExpert,
  patchExpertAvailability,
  patchGrantVisibility,
  patchWorkVisibility,
  deleteAuthorship
} from './lib/profile-updates.js';


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
  parseYearWeek,
  patchExpertVisibility,
  deleteExpert,
  patchExpertAvailability,
  patchGrantVisibility,
  patchWorkVisibility,
  deleteAuthorship
};