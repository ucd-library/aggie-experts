import { buildDailyDateFilter, mergeFilters } from './filters.js';

/**
 * @description Request breakdown by country over the date range, using the
 * unsampled httpRequests1dGroups dataset (works on all plans). Cloudflare may
 * return one row per day even without requesting a date dimension (the
 * dataset is pre-aggregated daily); toRows() sums each day's countryMap
 * together so the CSV is a single breakdown for the whole range. Unlike every
 * other view, this one is NOT filtered to statusClass: httpRequests1dGroups's
 * filter type (ZoneHttpRequests1dGroupsFilter_InputObject, confirmed via
 * schema introspection) exposes only date/date_geq/date_leq/etc, with no
 * edgeResponseStatus field at all, so counts here include every status class.
 * @type {import('./index.js').View}
 */
export const countryBreakdownView = {
  name: 'country-breakdown',
  description: 'Request breakdown by country over the date range',
  defaultFilename: 'country-breakdown.csv',
  requiresBotManagement: false,

  buildQuery(filters) {
    return {
      datasetField: 'httpRequests1dGroups',
      selection: 'sum { countryMap { clientCountryName requests bytes threats } }',
      filter: mergeFilters(buildDailyDateFilter(filters)),
      limit: 1000
    };
  },

  toRows(rows) {
    const totalsByCountry = new Map();
    for (const row of rows) {
      for (const entry of row.sum?.countryMap || []) {
        const key = entry.clientCountryName;
        const totals = totalsByCountry.get(key) || { country: key, requests: 0, bytes: 0, threats: 0 };
        totals.requests += entry.requests || 0;
        totals.bytes += entry.bytes || 0;
        totals.threats += entry.threats || 0;
        totalsByCountry.set(key, totals);
      }
    }
    return [...totalsByCountry.values()].sort((a, b) => b.requests - a.requests);
  }
};

export default countryBreakdownView;
