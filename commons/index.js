import { Elasticsearch, getEsClient } from './lib/elasticsearch/index.js';
import { ORG_LOOKUP } from './lib/org-lookup.js';
import {
  expandDeptParam as _expandDeptParam,
  deptCodesToOfficialNames as _deptCodesToOfficialNames
} from './lib/dept-utils.js';
import { logger, logReqMiddleware, createLogger } from './lib/logger.js';
import GoogleSecret from './lib/google-secret.js';
import SlackNotifier from './lib/slack-notifier.js';
import config from './lib/config.js';
import { getYearWeek, getTodaysDate, isPlainDate, parseYearWeek } from './lib/year-week.js';
import ElementsClient from './lib/elements-client.js';
import ExpertsKcAdminClient from './lib/keycloak-admin.js';

// dept-utils is data-injected (see commons/lib/dept-utils.js). Server-side callers
// don't carry the ORG_LOOKUP table around, so bind it here to preserve the original
// (dept, deptCodesIncluded, deptCodesExcluded) / (codes) signatures.
const expandDeptParam = (dept, deptCodesIncluded, deptCodesExcluded) =>
  _expandDeptParam(ORG_LOOKUP, dept, deptCodesIncluded, deptCodesExcluded);
const deptCodesToOfficialNames = (codes) =>
  _deptCodesToOfficialNames(ORG_LOOKUP, codes);


export {
  ORG_LOOKUP,
  expandDeptParam,
  deptCodesToOfficialNames,
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
  parseYearWeek
};