#!/usr/bin/env node
/**
 * experts harvest grant-feed process
 *
 * Orchestrates the full weekly grant-feed ETL:
 *   1. transform this week's AE XML into generation CSVs in CasKFS
 *   2. diff against last week's cached generation into delta CSVs in CasKFS
 *   3. SFTP the delta CSVs to the Symplectic Elements server (on by default;
 *      disable with --no-upload)
 *   4. load the week's delta into the grant_feed reporting schema (best-effort)
 *
 * Steps 1-2 are spawned as the sibling `transform` / `delta` CLIs so they can
 * also be run independently or wired into Dagster one asset at a time. The
 * upload reads the delta straight out of CasKFS.
 */
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import { parse } from 'csv-parse/sync';
import Client from 'ssh2-sftp-client';
import { Temporal } from '@js-temporal/polyfill';
import { logger, GoogleSecret, config, getTodaysDate } from '@ucd-lib/experts-commons';
import cache from '../lib/cache.js';
import PgClient from '../lib/pg-client.js';
import { deltaPath, DELTA_FILES, toSymplecticFileName, loadGrantFeedReporting } from '../lib/grant-feed/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('process')
  .description('Run the full weekly AE grant-feed ETL: transform, diff vs last week, and upload the delta to Symplectic')
  .option('--env <env>', 'QA | PROD (controls the Symplectic upload filename prefix and remote directory)', 'PROD')
  .option('-d, --date <date>', 'Week to process (YYYY-MM-DD); defaults to today', null)
  .option('--xml <xml>', 'Optional input override (local path or gs://...); defaults to the raw ae-grants.xml in CasKFS for the week')
  .option('--no-upload', 'Skip the SFTP upload to Symplectic (transform + delta only)')
  .option('-h, --host <host>', 'SFTP host', config.grantFeed?.symplectic?.host || 'ftp.use.symplectic.org')
  .option('-u, --username <username>', 'SFTP username', config.grantFeed?.symplectic?.username || 'ucdavis')
  .option('--secret-name <secret>', 'Secret Manager key holding the SFTP password', config.grantFeed?.symplectic?.passwordSecret || 'Symplectic-Elements-FTP-ucdavis-password')
  .action(async (opts) => {
    // Timezone-aware "today" (America/Los_Angeles), then pass an explicit
    // --date to the transform/delta children so all steps agree on the week.
    // env is NOT passed to transform/delta — cache filenames are env-agnostic;
    // env only controls the Symplectic upload name/target below.
    const date = opts.date ? Temporal.PlainDate.from(opts.date) : getTodaysDate();

    const weeklyPath = cache.getPath({ root: '/weekly', date });

    const transformArgs = ['transform', '--date', date.toString()];
    if (opts.xml) transformArgs.push('--xml', opts.xml);
    runChild(transformArgs);

    // Capture the delta summary — it carries newGrantIds (computed from both
    // generations it already has), so we classify new vs updated without
    // re-reading last week's generation here.
    const deltaSummary = runChild(['delta', '--date', date.toString()], { capture: true }) || {};
    const newGrantIds = new Set(deltaSummary.newGrantIds || []);

    // Read + parse the delta CSVs once (for the summary counts and the
    // reporting-DB load). Upload re-reads the raw bytes separately so it sends
    // exactly what delta wrote.
    const rows = await readDeltaRows(weeklyPath);
    const counts = {
      grants: rows.metadata.length,
      links: rows.links.length,
      persons: rows.persons.length,
      deletes: rows.deleteLinks.length
    };

    let uploaded = false;
    if (opts.upload) {
      await uploadDeltaToSymplectic(opts, weeklyPath);
      uploaded = true;
    } else {
      logger.info('Skipping Symplectic upload (--no-upload).');
    }

    await cache.close();

    // Load the weekly delta into the grant_feed reporting schema. Best-effort:
    // a reporting failure must not fail an otherwise-successful grant delivery.
    const yearWeek = path.basename(weeklyPath);
    const reportingLoaded = await loadReporting(yearWeek, uploaded, rows, newGrantIds);

    // Final line is a JSON summary the Dagster asset parses to build the
    // Slack notification (success + grant count).
    console.log(JSON.stringify({ success: true, uploaded, reportingLoaded, weeklyPath, ...counts }));
    process.exit();
  });

/**
 * Spawn a sibling grant-feed subcommand CLI (transform / delta). We invoke the
 * dispatcher so the child resolves through the same code path as the CLI.
 *
 * With { capture: true }, the child's stdout is captured (and echoed so nothing
 * is lost from the log), and this returns the parsed JSON of its last stdout
 * line (the child's summary) — used to read the delta stage's newGrantIds.
 */
function runChild(args, { capture = false } = {}) {
  const dispatcher = path.join(__dirname, 'experts-harvest-grant-feed.js');
  logger.info(`spawn: experts-harvest-grant-feed ${args.join(' ')}`);
  const result = spawnSync('node', [dispatcher, ...args], {
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`grant-feed ${args[0]} exited with status ${result.status}`);
  }
  if (!capture) return undefined;
  if (result.stdout) process.stdout.write(result.stdout);
  return parseLastJsonLine(result.stdout);
}

/** Parse the last non-empty line of a string as JSON, or return {} on failure. */
function parseLastJsonLine(text) {
  if (!text) return {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]); } catch (_) { /* keep scanning up */ }
  }
  return {};
}

/**
 * Read and parse each delta CSV from CasKFS into row arrays keyed by the
 * reporting-loader's expected names.
 */
async function readDeltaRows(weeklyPath) {
  const readParse = async (name) => {
    const assetPath = deltaPath(weeklyPath, name);
    if (!(await cache.exists(assetPath))) return [];
    const data = await cache.read(assetPath);
    if (!data || !data.trim()) return [];
    return parse(data, { columns: true, skip_empty_lines: true });
  };
  return {
    metadata: await readParse('grants-metadata'),
    links: await readParse('grants-links'),
    persons: await readParse('grants-persons'),
    deleteLinks: await readParse('delete-user-grants-links')
  };
}

/**
 * Upsert the week's delta into the grant_feed reporting schema. Best-effort:
 * logs and returns false on failure rather than throwing, so a reporting-DB
 * problem never fails a grant delivery that already succeeded.
 */
async function loadReporting(yearWeek, uploaded, rows, newGrantIds) {
  const pg = new PgClient(null, 'grant_feed');
  try {
    await pg.connect();
    const res = await loadGrantFeedReporting(pg, { yearWeek, uploaded, ...rows, newGrantIds });
    logger.info('grant_feed reporting loaded', res);
    return true;
  } catch (err) {
    logger.error(`grant_feed reporting load failed (continuing): ${err.message}`);
    return false;
  } finally {
    try { await pg.end(); } catch (_) { /* ignore */ }
  }
}

/**
 * Read the delta CSVs from CasKFS and SFTP them to Symplectic.
 */
async function uploadDeltaToSymplectic(opts, weeklyPath) {
  const password = await GoogleSecret.getSecret(opts.secretName);
  const sftp = new Client();
  try {
    await sftp.connect({ host: opts.host, port: 22, username: opts.username, password });
    for (const name of DELTA_FILES) {
      const assetPath = deltaPath(weeklyPath, name);
      if (!(await cache.exists(assetPath))) {
        throw new Error(`Delta file missing in CasKFS, cannot upload: ${assetPath}`);
      }
      const body = await cache.read(assetPath);
      // Rename to the legacy Symplectic filename (Prod_UCD_ + underscores) on
      // the way out; the cache keeps clean lower-case/hyphen names.
      const remote = `/${opts.env}/${toSymplecticFileName(name, opts.env)}`;
      logger.info(`SFTP put ${assetPath} -> ${remote}`);
      await sftp.put(Buffer.from(body, 'utf8'), remote);
    }
  } finally {
    await sftp.end();
  }
}

program.parseAsync(process.argv).catch(err => {
  logger.error('grant-feed process failed', err);
  process.exit(1);
});
