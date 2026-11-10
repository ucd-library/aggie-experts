import apiCallsView from './api-calls.js';
import botPageViewsView from './bot-page-views.js';
import humanPageViewsView from './human-page-views.js';
import uniqueBotVisitorsView from './unique-bot-visitors.js';
import uniqueHumanVisitorsView from './unique-human-visitors.js';
import topPagesView from './top-pages.js';
import countryBreakdownView from './country-breakdown.js';

/**
 * @typedef {import('./filters.js').ViewFilters} ViewFilters
 */

/**
 * @typedef {Object} View
 * @property {string} name - CLI-facing id, e.g. "top-pages". Used in --views and views:<name>.
 * @property {string} description - One-line help text.
 * @property {string} defaultFilename - e.g. "top-pages.csv".
 * @property {boolean} [requiresBotManagement] - If true, export/view-run probe capability first.
 * @property {function(ViewFilters): Object} buildQuery - Pure: filters -> { datasetField, selection, filter, limit, orderBy, cursorField? }.
 * @property {function(Array<Object>, ViewFilters): Array<Object>} toRows - Pure: raw Cloudflare rows -> flat CSV-ready rows.
 * @property {function({client: Object, filters: ViewFilters}): Promise<Array<Object>>} [run] - Optional override for views needing multi-query composition.
 */

/** @type {Record<string, View>} */
export const VIEWS = {
  'api-calls': apiCallsView,
  'bot-page-views': botPageViewsView,
  'human-page-views': humanPageViewsView,
  'unique-bot-visitors': uniqueBotVisitorsView,
  'unique-human-visitors': uniqueHumanVisitorsView,
  'top-pages': topPagesView,
  'country-breakdown': countryBreakdownView
};

/**
 * @description Shared default run path used by every precooked view (and
 * available to the generic query command): buildQuery -> client query -> toRows.
 * A view may override `run` when it needs more than one query (e.g. pagination
 * plus client-side aggregation).
 * @param {Object} opts
 * @param {View} opts.view
 * @param {Object} opts.client - A CloudflareClient instance.
 * @param {ViewFilters} opts.filters
 * @returns {Promise<Array<Object>>} CSV-ready rows.
 */
export async function runView({ view, client, filters } = {}) {
  if (view.run) {
    return view.run({ client, filters });
  }

  const plan = view.buildQuery(filters);
  const rawRows = plan.cursorField
    ? await client.runGroupsQueryAll(plan)
    : await client.runGroupsQuery(plan);

  return view.toRows(rawRows, filters);
}

/**
 * @description Looks up one or more views by name, throwing a clear error
 * listing valid names if any are unrecognized.
 * @param {string[]} names
 * @returns {View[]}
 */
export function resolveViews(names) {
  const unknown = names.filter(name => !VIEWS[name]);
  if (unknown.length) {
    throw new Error(`Unknown view(s): ${unknown.join(', ')}. Valid views: ${Object.keys(VIEWS).join(', ')}`);
  }
  return names.map(name => VIEWS[name]);
}

export default VIEWS;
