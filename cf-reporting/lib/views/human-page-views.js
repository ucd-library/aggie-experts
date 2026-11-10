import config from '../config.js';
import { buildDateFilter, buildStatusClassFilter, mergeFilters } from './filters.js';

/**
 * @description Exact-match routes the SPA serves directly; a request to one
 * of these is a real page view on its own. Shared with `bot-page-views.js`,
 * which applies the same route whitelist to bot-scored traffic.
 */
export const DIRECT_PATHS = ['/', '/browse', '/search', '/expert', '/work', '/grant', '/search-tips', '/faq'];

/**
 * @description Entity types with a corresponding `/api/<entity>` route. The
 * SPA fetches these client-side on navigation, so a request to one of them
 * (or anything nested under it) stands in for a page view the server never
 * otherwise sees. Shared with `bot-page-views.js`.
 */
export const API_ENTITY_TYPES = ['search', 'expert', 'work', 'grant'];

/**
 * @description Rewrites an `/api/*` request path to the front-end route it
 * represents, e.g. `/api/expert/21453` -> `/expert/21453`, and
 * `/api/grant/browse` -> `/browse/grant` (a `browse` segment moves to the
 * front of the path).
 * @param {string} rawPath
 * @returns {string}
 */
export function rewriteApiPath(rawPath) {
  const [, entityType, ...rest] = rawPath.split('/').filter(Boolean);
  if (rest[0] === 'browse') {
    return `/browse/${[entityType, ...rest.slice(1)].join('/')}`;
  }
  return `/${[entityType, ...rest].join('/')}`;
}

/**
 * @description Page-view breakdown, by real SPA route, for requests scored
 * at or above the bot-score threshold (i.e. likely humans). Since this is a
 * SPA, client-side navigation never reaches the server, so only direct loads
 * of a real route and the `/api/*` data-fetch a route triggers count as page
 * views; everything else (assets, other API calls) is excluded. `/api/*`
 * paths are rewritten to their front-end route (see `rewriteApiPath`) so a
 * direct load and the matching API call merge into one count. Requires Bot
 * Management to be enabled on the zone.
 * @type {import('./index.js').View}
 */
export const humanPageViewsView = {
  name: 'human-page-views',
  description: 'Human page-view breakdown by real SPA route (requires Bot Management)',
  defaultFilename: 'human-page-views.csv',
  requiresBotManagement: true,

  buildQuery(filters) {
    const threshold = filters.botScoreThreshold ?? config.cloudflare.botScoreThreshold;
    const limit = filters.limit ?? 1000;
    return {
      datasetField: 'httpRequestsAdaptiveGroups',
      selection: 'count dimensions { clientRequestPath }',
      filter: mergeFilters(buildDateFilter(filters), buildStatusClassFilter(filters), { botScore_geq: threshold }, {
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

export default humanPageViewsView;
