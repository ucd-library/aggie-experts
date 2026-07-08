#!/usr/bin/env node
/**
 * experts harvest grant-feed process
 *
 * Orchestrates the full weekly grant-feed ETL:
 *   1. transform this week's AE XML into generation CSVs in CasKFS
 *   2. diff against last week's cached generation into delta CSVs in CasKFS
 *   3. SFTP the delta CSVs to the Symplectic Elements server (on by default;
 *      disable with --no-upload)
 *
 * Steps 1-2 are spawned as the sibling `transform` / `delta` CLIs so they can
 * also be run independently or wired into Dagster one asset at a time. The
 * upload reads the delta straight out of CasKFS.
 */
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import Client from 'ssh2-sftp-client';
import { Temporal } from '@js-temporal/polyfill';
import { logger, GoogleSecret, config, getTodaysDate } from '@ucd-lib/experts-commons';
import cache from '../lib/cache.js';
import { deltaPath, DELTA_FILES } from '../lib/grant-feed/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('process')
  .description('Run the full weekly AE grant-feed ETL: transform, diff vs last week, and upload the delta to Symplectic')
  .option('--env <env>', 'QA | PROD (controls Prod_UCD_ filename prefix)', 'PROD')
  .option('-d, --date <date>', 'Week to process (YYYY-MM-DD); defaults to today', null)
  .option('--xml <xml>', 'Optional input override (local path or gs://...); defaults to the raw AEgrants.xml in CasKFS for the week')
  .option('--no-upload', 'Skip the SFTP upload to Symplectic (transform + delta only)')
  .option('-h, --host <host>', 'SFTP host', config.grantFeed?.symplectic?.host || 'ftp.use.symplectic.org')
  .option('-u, --username <username>', 'SFTP username', config.grantFeed?.symplectic?.username || 'ucdavis')
  .option('--secret-name <secret>', 'Secret Manager key holding the SFTP password', config.grantFeed?.symplectic?.passwordSecret || 'Symplectic-Elements-FTP-ucdavis-password')
  .action(async (opts) => {
    const prefix = opts.env === 'PROD' ? 'Prod_UCD_' : '';
    // Timezone-aware "today" (America/Los_Angeles), then pass an explicit
    // --date to the transform/delta children so all steps agree on the week.
    const date = opts.date ? Temporal.PlainDate.from(opts.date) : getTodaysDate();

    const weeklyPath = cache.getPath({ root: '/weekly', date });

    const transformArgs = ['transform', '--env', opts.env, '--date', date.toString()];
    if (opts.xml) transformArgs.push('--xml', opts.xml);
    runChild(transformArgs);

    runChild(['delta', '--env', opts.env, '--date', date.toString()]);

    const counts = await countDelta(weeklyPath, prefix);

    let uploaded = false;
    if (opts.upload) {
      await uploadDeltaToSymplectic(opts, prefix, weeklyPath);
      uploaded = true;
    } else {
      logger.info('Skipping Symplectic upload (--no-upload).');
    }

    await cache.close();

    // Final line is a JSON summary the Dagster asset parses to build the
    // Slack notification (success + grant count).
    console.log(JSON.stringify({ success: true, uploaded, weeklyPath, ...counts }));
    process.exit();
  });

/**
 * Spawn a sibling grant-feed subcommand CLI (transform / delta). We invoke the
 * dispatcher so the child resolves through the same code path as the CLI.
 */
function runChild(args) {
  const dispatcher = path.join(__dirname, 'experts-harvest-grant-feed.js');
  logger.info(`spawn: experts-harvest-grant-feed ${args.join(' ')}`);
  const result = spawnSync('node', [dispatcher, ...args], { stdio: 'inherit', encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`grant-feed ${args[0]} exited with status ${result.status}`);
  }
}

/**
 * Count the data rows in each delta CSV (for the run summary / notification).
 */
async function countDelta(weeklyPath, prefix) {
  const keys = {
    grants_metadata: 'grants',
    grants_links: 'links',
    grants_persons: 'persons',
    delete_user_grants_links: 'deletes'
  };
  const counts = {};
  for (const [name, key] of Object.entries(keys)) {
    const assetPath = deltaPath(weeklyPath, name, prefix);
    counts[key] = (await cache.exists(assetPath)) ? countRows(await cache.read(assetPath)) : 0;
  }
  return counts;
}

/** Data-row count of a CSV string (total non-empty lines minus the header). */
function countRows(csv) {
  if (!csv) return 0;
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  return Math.max(0, lines.length - 1);
}

/**
 * Read the delta CSVs from CasKFS and SFTP them to Symplectic.
 */
async function uploadDeltaToSymplectic(opts, prefix, weeklyPath) {
  const password = await GoogleSecret.getSecret(opts.secretName);
  const sftp = new Client();
  try {
    await sftp.connect({ host: opts.host, port: 22, username: opts.username, password });
    for (const name of DELTA_FILES) {
      const assetPath = deltaPath(weeklyPath, name, prefix);
      if (!(await cache.exists(assetPath))) {
        throw new Error(`Delta file missing in CasKFS, cannot upload: ${assetPath}`);
      }
      const body = await cache.read(assetPath);
      const remote = `/${opts.env}/${prefix}${name}.csv`;
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
