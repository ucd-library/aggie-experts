import { Elasticsearch, getEsClient } from './lib/elasticsearch/index.js';
import { logger, logReqMiddleware, createLogger } from './lib/logger.js';
import GoogleSecret from './lib/google-secret.js';
import SlackNotifier from './lib/slack-notifier.js';
import config from './lib/config.js';
import { getYearWeek, getTodaysDate, isPlainDate, parseYearWeek } from './lib/year-week.js';
import ElementsClient from './lib/elements-client.js';
import ExpertsKcAdminClient from './lib/keycloak-admin.js';
import {
  patchExpertVisibility,
  patchExpertEsVisibility,
  patchExpertCdlVisibility,
  deleteExpert,
  patchExpertAvailability,
  patchExpertAvailabilityEs,
  patchExpertAvailabilityCdl,
  patchGrantVisibility,
  patchGrantEsVisibility,
  patchGrantCdlVisibility,
  patchWorkVisibility,
  patchWorkEsVisibility,
  patchWorkCdlVisibility,
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
  SlackNotifier,
  config,
  getYearWeek,
  getTodaysDate,
  isPlainDate,
  parseYearWeek,
  patchExpertVisibility,
  patchExpertEsVisibility,
  patchExpertCdlVisibility,
  deleteExpert,
  patchExpertAvailability,
  patchExpertAvailabilityEs,
  patchExpertAvailabilityCdl,
  patchGrantVisibility,
  patchGrantEsVisibility,
  patchGrantCdlVisibility,
  patchWorkVisibility,
  patchWorkEsVisibility,
  patchWorkCdlVisibility,
  deleteAuthorship
};