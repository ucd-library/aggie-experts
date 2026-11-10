import config from '../config.js';
import { buildDateFilter, buildStatusClassFilter, mergeFilters } from './filters.js';

/**
 * @description Top N pages by request volume over the date range. Note:
 * httpRequestsAdaptiveGroups is sampled/estimated on high-volume zones, so
 * counts here are an estimate rather than an exact total.
 * @type {import('./index.js').View}
 */
export const topPagesView = {
  name: 'top-pages',
  description: 'Top N pages by views (default 50, override with --limit)',
  defaultFilename: 'top-pages.csv',
  requiresBotManagement: false,

  buildQuery(filters) {
    const limit = filters.limit ?? config.report.defaultTopPagesLimit;
    return {
      datasetField: 'httpRequestsAdaptiveGroups',
      selection: 'count dimensions { clientRequestPath }',
      filter: mergeFilters(buildDateFilter(filters), buildStatusClassFilter(filters)),
      limit,
      orderBy: ['count_DESC']
    };
  },

  toRows(rows) {
    return rows.map(row => ({ path: row.dimensions.clientRequestPath, views: row.count }));
  }
};

export default topPagesView;
