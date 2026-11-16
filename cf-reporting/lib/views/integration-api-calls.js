import { buildDateFilter, mergeFilters } from './filters.js';

/**
 * @description Integration API names. Each is served under /api/<name> and
 * becomes the value of the helper `type` column.
 * @type {string[]}
 */
export const INTEGRATION_TYPES = ['sitefarm', 'miv'];

/**
 * @description Resolves which integration API a request path belongs to.
 * @param {string} path - Request path, e.g. "/api/miv/grants".
 * @returns {string} The integration type ("sitefarm" or "miv"), or an empty string if the path matches neither.
 */
export function getIntegrationType(path) {
  return INTEGRATION_TYPES.find(type => path === `/api/${type}` || path.startsWith(`/api/${type}/`)) || '';
}

/**
 * @description Rolls an HTTP status code up to its status class.
 * @param {number} status - Edge response status, e.g. 404.
 * @returns {string} Status class, e.g. "4xx".
 */
export function getStatusClass(status) {
  return `${Math.floor(Number(status) / 100)}xx`;
}

/**
 * @description Per-path, per-status-class count of requests to the integration
 * APIs (/api/sitefarm and /api/miv, plus child paths). Counts humans and bots
 * together, so it works on all Cloudflare plans. Unlike the other views it is
 * not restricted by the global status class filter, so failed requests show up.
 * @type {import('./index.js').View}
 */
export const integrationApiCallsView = {
  name: 'integration-api-calls',
  description: 'MIV and SiteFarm API call count by path and status class (all statuses, humans and bots)',
  defaultFilename: 'integration-api-calls.csv',
  requiresBotManagement: false,

  buildQuery(filters) {
    return {
      datasetField: 'httpRequestsAdaptiveGroups',
      selection: 'count dimensions { clientRequestPath edgeResponseStatus }',
      filter: mergeFilters(buildDateFilter(filters), {
        OR: [
          { clientRequestPath_in: INTEGRATION_TYPES.map(type => `/api/${type}`) },
          ...INTEGRATION_TYPES.map(type => ({ clientRequestPath_like: `/api/${type}/%` }))
        ]
      }),
      limit: 5000,
      orderBy: ['count_DESC']
    };
  },

  toRows(rows) {
    const totalsByKey = new Map();
    for (const row of rows) {
      const path = row.dimensions.clientRequestPath;
      const statusClass = getStatusClass(row.dimensions.edgeResponseStatus);
      const key = `${statusClass} ${path}`;
      const totals = totalsByKey.get(key) || { type: getIntegrationType(path), path, statusClass, calls: 0 };
      totals.calls += row.count || 0;
      totalsByKey.set(key, totals);
    }
    return [...totalsByKey.values()].sort((a, b) => b.calls - a.calls);
  }
};

export default integrationApiCallsView;
