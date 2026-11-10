import config from '../config.js';

/**
 * @typedef {Object} ViewFilters
 * @property {string} sinceDate - YYYY-MM-DD, inclusive.
 * @property {string} untilDate - YYYY-MM-DD, inclusive.
 * @property {number} [limit] - Row cap, view-specific meaning (e.g. top-N pages).
 * @property {string} [apiPathPrefix] - Path prefix counted as an API call.
 * @property {number} [botScoreThreshold] - Score below which a request is treated as a bot.
 * @property {string} [statusClass] - HTTP status class every view is filtered to, e.g. "2xx".
 */

/**
 * @description Builds the date-range filter clause shared by every view, as a
 * half-open ISO datetime range [sinceDate 00:00:00Z, untilDate+1day 00:00:00Z).
 * @param {ViewFilters} filters
 * @returns {Object} e.g. { datetime_geq: '2026-10-01T00:00:00Z', datetime_lt: '2026-10-31T00:00:00Z' }
 */
export function buildDateFilter(filters) {
  const since = new Date(`${filters.sinceDate}T00:00:00Z`);
  const untilExclusive = new Date(`${filters.untilDate}T00:00:00Z`);
  untilExclusive.setUTCDate(untilExclusive.getUTCDate() + 1);

  return {
    datetime_geq: since.toISOString(),
    datetime_lt: untilExclusive.toISOString()
  };
}

/**
 * @description Builds the date-range filter clause for daily pre-aggregated
 * datasets (e.g. httpRequests1dGroups), as an inclusive date range
 * [sinceDate, untilDate]. Unlike buildDateFilter, these datasets' filter type
 * only exposes date_geq/date_leq on a plain YYYY-MM-DD value, not datetime_*.
 * @param {ViewFilters} filters
 * @returns {Object} e.g. { date_geq: '2026-10-01', date_leq: '2026-10-31' }
 */
export function buildDailyDateFilter(filters) {
  return {
    date_geq: filters.sinceDate,
    date_leq: filters.untilDate
  };
}

/**
 * @description Merges any number of GraphQL filter clause objects by ANDing
 * their keys together (Cloudflare's filter syntax treats sibling keys on one
 * object as an implicit AND).
 * @param {...Object} clauses
 * @returns {Object}
 */
export function mergeFilters(...clauses) {
  return Object.assign({}, ...clauses.filter(Boolean));
}

/**
 * @description Builds the global HTTP status-class filter clause shared by
 * every view, e.g. "2xx" -> edgeResponseStatus in [200, 300). Falls back to
 * config.cloudflare.statusClass when filters.statusClass is not set.
 * @param {ViewFilters} filters
 * @returns {Object} e.g. { edgeResponseStatus_geq: 200, edgeResponseStatus_lt: 300 }
 */
export function buildStatusClassFilter(filters) {
  const statusClass = filters.statusClass ?? config.cloudflare.statusClass;
  const match = /^([1-5])xx$/i.exec(statusClass);
  if (!match) {
    throw new Error(`Invalid statusClass "${statusClass}": expected one of 1xx, 2xx, 3xx, 4xx, 5xx`);
  }

  const rangeStart = Number(match[1]) * 100;
  return {
    edgeResponseStatus_geq: rangeStart,
    edgeResponseStatus_lt: rangeStart + 100
  };
}

/**
 * @description Formats a ViewFilters object as a plain `key=value` list for
 * console output, omitting keys whose value is undefined.
 * @param {ViewFilters} filters
 * @returns {string} e.g. 'sinceDate=2026-10-01, untilDate=2026-10-31, limit=50'
 */
export function formatFilters(filters) {
  return Object.entries(filters)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}
