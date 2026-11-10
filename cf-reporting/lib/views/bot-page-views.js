import config from '../config.js';
import { buildDateFilter, buildStatusClassFilter, mergeFilters } from './filters.js';
import { DIRECT_PATHS, API_ENTITY_TYPES, rewriteApiPath } from './human-page-views.js';

/**
 * @description Page-view breakdown, by real SPA route, for requests scored
 * below the bot-score threshold (i.e. likely bots). Since this is a SPA,
 * client-side navigation never reaches the server, so only direct loads of a
 * real route and the `/api/*` data-fetch a route triggers count as page
 * views; everything else (assets, other API calls) is excluded. `/api/*`
 * paths are rewritten to their front-end route (see `rewriteApiPath`) so a
 * direct load and the matching API call merge into one count. Requires Bot
 * Management to be enabled on the zone.
 * @type {import('./index.js').View}
 */
export const botPageViewsView = {
  name: 'bot-page-views',
  description: 'Bot page-view breakdown by real SPA route (requires Bot Management)',
  defaultFilename: 'bot-page-views.csv',
  requiresBotManagement: true,

  buildQuery(filters) {
    const threshold = filters.botScoreThreshold ?? config.cloudflare.botScoreThreshold;
    const limit = filters.limit ?? 1000;
    return {
      datasetField: 'httpRequestsAdaptiveGroups',
      selection: 'count dimensions { clientRequestPath }',
      filter: mergeFilters(buildDateFilter(filters), buildStatusClassFilter(filters), { botScore_lt: threshold }, {
        OR: [
          { clientRequestPath_in: [...DIRECT_PATHS, ...API_ENTITY_TYPES.map(entity => `/api/${entity}`)] },
          ...API_ENTITY_TYPES.map(entity => ({ clientRequestPath_like: `/api/${entity}/%` }))
        ]
      }),
      limit,
      orderBy: ['count_DESC']
    };
  },

  toRows(rows) {
    const totalsByPath = new Map();
    for (const row of rows) {
      const rawPath = row.dimensions.clientRequestPath;
      const path = rawPath.startsWith('/api/') ? rewriteApiPath(rawPath) : rawPath;
      const totals = totalsByPath.get(path) || { path, pageViews: 0 };
      totals.pageViews += row.count || 0;
      totalsByPath.set(path, totals);
    }
    return [...totalsByPath.values()].sort((a, b) => b.pageViews - a.pageViews);
  }
};

export default botPageViewsView;
