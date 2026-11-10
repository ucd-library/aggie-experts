import config from '../config.js';
import { buildDateFilter, buildStatusClassFilter, mergeFilters } from './filters.js';

/**
 * @description Per-path count of requests whose path matches the configured
 * API path prefix. Works on all Cloudflare plans.
 * @type {import('./index.js').View}
 */
export const apiCallsView = {
  name: 'api-calls',
  description: 'API endpoint call count by path (requests under the configured API path prefix)',
  defaultFilename: 'api-calls.csv',
  requiresBotManagement: false,

  buildQuery(filters) {
    const apiPathPrefix = filters.apiPathPrefix || config.cloudflare.apiPathPrefix;
    return {
      datasetField: 'httpRequestsAdaptiveGroups',
      selection: 'count dimensions { clientRequestPath }',
      filter: mergeFilters(buildDateFilter(filters), buildStatusClassFilter(filters), { clientRequestPath_like: `${apiPathPrefix}%` }),
      limit: 1000,
      orderBy: ['count_DESC']
    };
  },

  toRows(rows) {
    return rows.map(row => ({ path: row.dimensions.clientRequestPath, calls: row.count }));
  }
};

export default apiCallsView;
