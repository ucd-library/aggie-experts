#!/usr/bin/env node
import { Command } from 'commander';
import { VIEWS } from '../lib/views/index.js';
import runExport from '../lib/commands/export.js';
import runViewCommand from '../lib/commands/view-run.js';
import runQuery from '../lib/commands/query.js';

const program = new Command();

/**
 * @param {string} value - A repeated option's new value.
 * @param {string[]} previous - Values collected from earlier occurrences of the option.
 * @returns {string[]} `previous` with `value` appended.
 */
function collect(value, previous) {
  return previous.concat([value]);
}

/**
 * @description Splits a comma-separated CLI option value into a trimmed, non-empty array.
 * @param {string} [value]
 * @returns {string[]}
 */
function splitList(value) {
  return (value || '').split(',').map(v => v.trim()).filter(Boolean);
}

program
  .name('cf-reporting')
  .description('Export Cloudflare zone analytics as CSV reports');

program
  .command('export')
  .description('Run precooked views for a date range and write one CSV per view into a dated output folder')
  .option('--days <n>', 'Lookback window in days, ending today (default: 30)', (v) => parseInt(v))
  .option('--start <date>', 'Range start, YYYY-MM-DD (requires --end)')
  .option('--end <date>', 'Range end, YYYY-MM-DD (requires --start)')
  .option('--views <list>', `Comma-separated view names to include (default: all). Valid: ${Object.keys(VIEWS).join(', ')}`)
  .option('--exclude-views <list>', 'Comma-separated view names to exclude, applied after --views')
  .option('--limit <n>', 'Row limit for the top-pages view (default: 50)', (v) => parseInt(v))
  .option('--api-path <prefix>', 'Path prefix counted as an API call for the api-calls view')
  .option('--zip', 'Zip the output folder and delete the unzipped copy', false)
  .option('-o, --output-dir <dir>', 'Parent directory for the dated output folder (default: current directory)')
  .option('--gcs-bucket <name>', 'If set (with --zip), upload the resulting zip to this GCS bucket (default: AE_AF_GCS_BUCKET)')
  .action(async (opts) => {
    await runExport({
      days: opts.days,
      start: opts.start,
      end: opts.end,
      includeViews: opts.views ? splitList(opts.views) : undefined,
      excludeViews: opts.excludeViews ? splitList(opts.excludeViews) : undefined,
      limit: opts.limit,
      apiPath: opts.apiPath,
      zip: opts.zip,
      outputDir: opts.outputDir,
      gcsBucket: opts.gcsBucket
    });
  });

for (const view of Object.values(VIEWS)) {
  program
    .command(`views:${view.name}`)
    .description(view.description)
    .option('--days <n>', 'Lookback window in days, ending today (default: 30)', (v) => parseInt(v))
    .option('--start <date>', 'Range start, YYYY-MM-DD (requires --end)')
    .option('--end <date>', 'Range end, YYYY-MM-DD (requires --start)')
    .option('--limit <n>', 'Row limit (only meaningful for top-pages)', (v) => parseInt(v))
    .option('--api-path <prefix>', 'Path prefix counted as an API call (only meaningful for api-calls)')
    .option('-o, --output <file>', `Output CSV path (default: ./${view.defaultFilename})`)
    .action(async (opts) => {
      await runViewCommand({
        viewName: view.name,
        days: opts.days,
        start: opts.start,
        end: opts.end,
        limit: opts.limit,
        apiPath: opts.apiPath,
        outputFile: opts.output
      });
    });
}

program
  .command('query')
  .description('Run an ad-hoc Cloudflare GraphQL Analytics query and write a single CSV')
  .requiredOption('--dataset <name>', 'e.g. httpRequestsAdaptiveGroups, httpRequests1dGroups')
  .option('--dimension <name>', 'Dimension field to group by (repeatable)', collect, [])
  .option('--sum <field>', 'Field to request under sum{} (repeatable)', collect, [])
  .option('--no-count', 'Omit the top-level count field')
  .option('--filter-json <json>', 'Extra raw GraphQL filter clauses as a JSON object, merged onto the date-range filter')
  .option('--days <n>', 'Lookback window in days, ending today (default: 30)', (v) => parseInt(v))
  .option('--start <date>', 'Range start, YYYY-MM-DD (requires --end)')
  .option('--end <date>', 'Range end, YYYY-MM-DD (requires --start)')
  .option('--limit <n>', 'Row limit (default: 1000)', (v) => parseInt(v))
  .option('--order-by <field>', 'GraphQL orderBy field, e.g. count_DESC (repeatable)', collect, [])
  .option('-o, --output <file>', 'Output CSV path (default: ./query.csv)')
  .action(async (opts) => {
    await runQuery({
      dataset: opts.dataset,
      dimensions: opts.dimension,
      sumFields: opts.sum,
      count: opts.count,
      extraFilter: opts.filterJson ? JSON.parse(opts.filterJson) : undefined,
      days: opts.days,
      start: opts.start,
      end: opts.end,
      limit: opts.limit,
      orderBy: opts.orderBy,
      outputFile: opts.output
    });
  });

program.parseAsync(process.argv).catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
