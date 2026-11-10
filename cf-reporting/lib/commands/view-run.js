import config from '../config.js';
import logger from '../logger.js';
import CloudflareClient from '../cloudflare-client.js';
import resolveDateRange from '../date-range.js';
import { resolveViews, runView } from '../views/index.js';
import { formatFilters } from '../views/filters.js';
import writeCsvFile from '../csv-writer.js';

/**
 * @description Runs exactly one precooked view and writes a single CSV file
 * (current directory by default), reusing the exact same buildQuery/toRows
 * path as the `export` command.
 * @param {Object} [opts={}]
 * @param {string} opts.viewName
 * @param {number} [opts.days]
 * @param {string} [opts.start]
 * @param {string} [opts.end]
 * @param {number} [opts.limit]
 * @param {string} [opts.apiPath]
 * @param {string} [opts.outputFile] - Defaults to `./<view.defaultFilename>`.
 * @param {Object} [opts.client] - Injectable CloudflareClient, mainly for tests.
 * @returns {Promise<string>} The file path written.
 */
export async function runViewCommand(opts = {}) {
  const [view] = resolveViews([opts.viewName]);

  const { sinceDate, untilDate } = resolveDateRange({
    days: opts.days,
    start: opts.start,
    end: opts.end,
    defaultDays: config.report.defaultDays
  });

  const client = opts.client || new CloudflareClient();

  if (view.requiresBotManagement) {
    const available = await client.checkBotManagementAvailable({ sinceDate, untilDate });
    if (!available) {
      throw new Error(`View "${view.name}" requires Bot Management, which is unavailable for this zone/token`);
    }
  }

  const filters = {
    sinceDate,
    untilDate,
    limit: opts.limit,
    apiPathPrefix: opts.apiPath,
    botScoreThreshold: config.cloudflare.botScoreThreshold,
    statusClass: config.cloudflare.statusClass
  };

  logger.info(`View: ${view.name}`);
  logger.info(`Filters: ${formatFilters(filters)}`);

  const rows = await runView({ view, client, filters });
  const filePath = opts.outputFile || `./${view.defaultFilename}`;
  await writeCsvFile({ rows, filePath });

  logger.info(`Wrote ${rows.length} row(s) to ${filePath}`);
  return filePath;
}

export default runViewCommand;
