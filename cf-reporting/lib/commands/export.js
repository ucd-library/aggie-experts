import path from 'path';
import fs from 'fs';
import config from '../config.js';
import logger from '../logger.js';
import CloudflareClient from '../cloudflare-client.js';
import resolveDateRange from '../date-range.js';
import { VIEWS, runView, resolveViews } from '../views/index.js';
import { formatFilters } from '../views/filters.js';
import writeCsvFile from '../csv-writer.js';
import zipDirectory from '../zip.js';
import { uploadFile } from '../gcs-uploader.js';

/**
 * @description Builds the dated export folder name: <appName-or-zoneId>-<sinceDate>-<untilDate>.
 * @param {Object} opts
 * @param {string} [opts.appName] - Defaults to config.cloudflare.appName || config.cloudflare.zoneId || 'export'.
 * @param {string} opts.sinceDate
 * @param {string} opts.untilDate
 * @returns {string}
 */
function buildOutputFolderName({ appName, sinceDate, untilDate }) {
  const resolvedAppName = appName || config.cloudflare.appName || config.cloudflare.zoneId || 'export';
  return `${resolvedAppName}-${sinceDate}-${untilDate}`;
}

/**
 * @description Runs a set of precooked views for one date range, writing one
 * CSV per view into a dated output folder, then optionally zips the folder
 * and deletes the unzipped copy.
 * @param {Object} [opts={}]
 * @param {number} [opts.days]
 * @param {string} [opts.start]
 * @param {string} [opts.end]
 * @param {string[]} [opts.includeViews] - View names to include (default: all).
 * @param {string[]} [opts.excludeViews] - View names to exclude, applied after includeViews.
 * @param {number} [opts.limit] - Overrides the top-pages row limit.
 * @param {string} [opts.apiPath] - Overrides the API path prefix.
 * @param {boolean} [opts.zip=false]
 * @param {string} [opts.outputDir] - Parent directory the dated folder is created in.
 * @param {string} [opts.appName] - Overrides config.cloudflare.appName for folder naming.
 * @param {string} [opts.gcsBucket] - If set (and opts.zip is true), uploads the resulting
 *   zip to this GCS bucket under its own basename. Defaults to config.report.gcsBucket.
 * @param {Object} [opts.client] - Injectable CloudflareClient, mainly for tests.
 * @param {Object} [opts.storage] - Injectable Storage client, mainly for tests.
 * @returns {Promise<{folderPath: string, zipPath: ?string, gcsPath: ?string, skippedViews: string[]}>}
 */
export async function runExport(opts = {}) {
  const { sinceDate, untilDate } = resolveDateRange({
    days: opts.days,
    start: opts.start,
    end: opts.end,
    defaultDays: config.report.defaultDays
  });

  const viewNames = opts.includeViews && opts.includeViews.length ? opts.includeViews : Object.keys(VIEWS);
  const excludeSet = new Set(opts.excludeViews || []);
  const views = resolveViews(viewNames.filter(name => !excludeSet.has(name)));

  const client = opts.client || new CloudflareClient();
  const filters = {
    sinceDate,
    untilDate,
    limit: opts.limit,
    apiPathPrefix: opts.apiPath,
    botScoreThreshold: config.cloudflare.botScoreThreshold,
    statusClass: config.cloudflare.statusClass
  };

  logger.info(`Views: ${views.map(view => view.name).join(', ')}`);
  logger.info(`Filters: ${formatFilters(filters)}`);

  const outputParentDir = opts.outputDir || config.report.outputDir;
  const folderPath = path.join(outputParentDir, buildOutputFolderName({ appName: opts.appName, sinceDate, untilDate }));
  await fs.promises.mkdir(folderPath, { recursive: true });

  const skippedViews = [];

  for (const view of views) {
    if (view.requiresBotManagement) {
      const available = await client.checkBotManagementAvailable({ sinceDate, untilDate });
      if (!available) {
        logger.warn(`Skipping view "${view.name}": Bot Management data is unavailable for this zone/token`);
        skippedViews.push(view.name);
        continue;
      }
    }

    logger.info(`Running view "${view.name}"...`);
    const rows = await runView({ view, client, filters });
    await writeCsvFile({ rows, filePath: path.join(folderPath, view.defaultFilename) });
  }

  let zipPath = null;
  let gcsPath = null;
  if (opts.zip) {
    zipPath = `${folderPath}.zip`;
    logger.info(`Zipping ${folderPath} -> ${zipPath}`);
    await zipDirectory(folderPath, zipPath);
    await fs.promises.rm(folderPath, { recursive: true, force: true });

    const gcsBucket = opts.gcsBucket || config.report.gcsBucket;
    if (gcsBucket) {
      gcsPath = await uploadFile(gcsBucket, zipPath, path.basename(zipPath), { storage: opts.storage });
    }
  }

  if (skippedViews.length) {
    logger.warn(`Export completed with ${skippedViews.length} view(s) skipped: ${skippedViews.join(', ')}`);
  }

  return { folderPath: opts.zip ? null : folderPath, zipPath, gcsPath, skippedViews };
}

export default runExport;
