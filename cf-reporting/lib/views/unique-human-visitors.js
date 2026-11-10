import config from '../config.js';
import { buildDateFilter, buildStatusClassFilter, mergeFilters } from './filters.js';

/**
 * @description Daily unique client-IP count for requests scored at or above
 * the bot-score threshold, used as a proxy for "unique human visitors".
 * Cloudflare's GraphQL Analytics API has no direct unique-visitor field at
 * this dimension level, so this pages through (date, clientIP) rows (see
 * `cursorField`) and counts distinct IPs per day client-side in toRows().
 * Requires Bot Management.
 * @type {import('./index.js').View}
 */
export const uniqueHumanVisitorsView = {
  name: 'unique-human-visitors',
  description: 'Daily unique human visitor count, approximated by distinct client IPs (requires Bot Management)',
  defaultFilename: 'unique-human-visitors.csv',
  requiresBotManagement: true,

  buildQuery(filters) {
    const threshold = filters.botScoreThreshold ?? config.cloudflare.botScoreThreshold;
    return {
      datasetField: 'httpRequestsAdaptiveGroups',
      selection: 'count dimensions { date clientIP datetime }',
      filter: mergeFilters(buildDateFilter(filters), buildStatusClassFilter(filters), { botScore_geq: threshold }),
      limit: 5000,
      orderBy: ['datetime_ASC'],
      cursorField: 'datetime'
    };
  },

  toRows(rows) {
    const uniqueIpsByDate = new Map();
    for (const row of rows) {
      const { date, clientIP } = row.dimensions;
      if (!uniqueIpsByDate.has(date)) uniqueIpsByDate.set(date, new Set());
      uniqueIpsByDate.get(date).add(clientIP);
    }
    return [...uniqueIpsByDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, ips]) => ({ date, uniqueVisitors: ips.size }));
  }
};

export default uniqueHumanVisitorsView;
