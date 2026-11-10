import config from '../config.js';
import logger from '../logger.js';
import CloudflareClient from '../cloudflare-client.js';
import resolveDateRange from '../date-range.js';
import { runView } from '../views/index.js';
import { buildDateFilter, buildDailyDateFilter, mergeFilters, formatFilters } from '../views/filters.js';
import writeCsvFile from '../csv-writer.js';

/**
 * @description Flattens one raw Cloudflare group row (dimensions/sum/count) into
 * a single flat object suitable for a CSV row.
 * @param {Object} row
 * @returns {Object}
 */
function flattenRow(row) {
  return {
    ...(row.dimensions || {}),
    ...(row.sum || {}),
    ...(row.count !== undefined ? { count: row.count } : {})
  };
}

/**
 * @description Runs an ad-hoc Cloudflare GraphQL Analytics query by assembling
 * an inline view object from CLI flags and writes a single CSV, via the exact
 * same runView()/writeCsvFile() path used by the precooked views.
 * @param {Object} [opts={}]
 * @param {string} opts.dataset - e.g. 'httpRequestsAdaptiveGroups'.
 * @param {string[]} [opts.dimensions] - Dimension field names to group by.
 * @param {string[]} [opts.sumFields] - Fields to request under `sum { }`.
 * @param {boolean} [opts.count=true] - Include the top-level `count` field.
 * @param {Object} [opts.extraFilter] - Additional raw filter clauses, merged onto the date-range filter.
 * @param {number} [opts.days]
 * @param {string} [opts.start]
 * @param {string} [opts.end]
 * @param {number} [opts.limit=1000]
 * @param {string[]} [opts.orderBy]
 * @param {string} [opts.outputFile] - Defaults to './query.csv'.
 * @param {Object} [opts.client] - Injectable CloudflareClient, mainly for tests.
 * @returns {Promise<string>} The file path written.
 */
export async function runQuery(opts = {}) {
  const { sinceDate, untilDate } = resolveDateRange({
    days: opts.days,
    start: opts.start,
    end: opts.end,
    defaultDays: config.report.defaultDays
  });

  const dimensions = opts.dimensions || [];
  const sumFields = opts.sumFields || [];
  const includeCount = opts.count !== false;

  const selectionParts = [];
  if (includeCount) selectionParts.push('count');
  if (dimensions.length) selectionParts.push(`dimensions { ${dimensions.join(' ')} }`);
  if (sumFields.length) selectionParts.push(`sum { ${sumFields.join(' ')} }`);

  const view = {
    name: 'query',
    buildQuery(filters) {
      const dateFilter = /1dGroups$/.test(opts.dataset)
        ? buildDailyDateFilter(filters)
        : buildDateFilter(filters);
      return {
        datasetField: opts.dataset,
        selection: selectionParts.join(' '),
        filter: mergeFilters(dateFilter, opts.extraFilter),
        limit: opts.limit || 1000,
        orderBy: opts.orderBy
      };
    },
    toRows(rows) {
      return rows.map(flattenRow);
    }
  };

  const client = opts.client || new CloudflareClient();
  const filters = { sinceDate, untilDate };

  logger.info(`View: query (dataset: ${opts.dataset})`);
  logger.info(`Filters: ${formatFilters(filters)}`);

  const rows = await runView({ view, client, filters });
  const filePath = opts.outputFile || './query.csv';
  await writeCsvFile({ rows, filePath });

  logger.info(`Wrote ${rows.length} row(s) to ${filePath}`);
  return filePath;
}

export default runQuery;
