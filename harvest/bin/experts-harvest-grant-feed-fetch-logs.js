#!/usr/bin/env node
/**
 * experts harvest grant-feed fetch-logs
 *
 * Pull the Symplectic Elements log files for a given import date from the SFTP
 * server, keep only the ones with meaningful content in CasKFS, and load the
 * import/delete confirmation into the grant_feed reporting schema.
 *
 * Meaningful = Symplectic actually processed our files:
 *   - grants feed:        Summary reports >= 1 item processed
 *   - delete user links:  >= 1 per-link outcome line
 *   - delete grant records (KFS legacy archive): >= 1 record deleted — archived
 *     to CasKFS only, not loaded into reporting (different ARK namespace).
 *
 * Reporting confirmation (grants feed + delete user links) is best-effort: a DB
 * failure is logged but does not fail the fetch.
 */
import { Command } from 'commander';
import Client from 'ssh2-sftp-client';
import { Temporal } from '@js-temporal/polyfill';
import { logger, config, GoogleSecret, getTodaysDate } from '@ucd-lib/experts-commons';
import cache from '../lib/cache.js';
import PgClient from '../lib/pg-client.js';
import {
  symplecticLogPath,
  LOG_CLEAN_NAMES,
  parseGrantsFeedSummary,
  grantImportResults,
  parseDeleteUserLinksNotes,
  parseDeleteGrantRecordsNotes,
  grantsFeedIsMeaningful,
  deleteUserLinksIsMeaningful,
  deleteGrantRecordsIsMeaningful,
  loadImportConfirmation
} from '../lib/grant-feed/index.js';

const program = new Command();

program
  .name('fetch-logs')
  .description('Fetch Symplectic import/delete logs for a date, keep the meaningful ones in CasKFS, and load the confirmation')
  .requiredOption('--env <env>', 'QA | PROD — which Symplectic instance to pull logs for')
  .option('-d, --date <date>', 'Import date to fetch (YYYY-MM-DD); defaults to today', null)
  .option('-h, --host <host>', 'SFTP host', config.grantFeed?.symplectic?.host || 'ftp.use.symplectic.org')
  .option('-u, --username <username>', 'SFTP username', config.grantFeed?.symplectic?.username || 'ucdavis')
  .option('--secret-name <secret>', 'Secret Manager key holding the SFTP password', config.grantFeed?.symplectic?.passwordSecret || 'Symplectic-Elements-FTP-ucdavis-password')
  .action(async (opts) => {
    const env = opts.env;
    if (env !== 'PROD' && env !== 'QA') throw new Error(`--env must be PROD or QA, got '${env}'`);
    const date = (opts.date ? Temporal.PlainDate.from(opts.date) : getTodaysDate()).toString();
    const dirs = config.grantFeed.symplectic.logs[env];
    const weeklyPath = cache.getPath({ root: '/weekly', date: Temporal.PlainDate.from(date) });
    const yearWeek = weeklyPath.split('/').pop();

    const sftp = new Client();
    const kept = {};      // clean-name -> true (archived)
    let grantsSummary = null, successesTxt = '', errorsTxt = '', delUserLinksTxt = '';

    try {
      const password = await GoogleSecret.getSecret(opts.secretName);
      await sftp.connect({ host: opts.host, port: 22, username: opts.username, password });

      // ---- grants feed: <root>/<grantsFeed>/<date>_(HH_MM)/ ------------------
      const gfParent = `${dirs.root}/${dirs.grantsFeed}`;
      const gfFolder = await findFolder(sftp, gfParent, n => n.startsWith(`${date}_(`));
      if (gfFolder) {
        const base = `${gfParent}/${gfFolder}`;
        const summaryTxt = await getText(sftp, `${base}/Summary_${gfFolder}.txt`);
        if (grantsFeedIsMeaningful(summaryTxt)) {
          grantsSummary = parseGrantsFeedSummary(summaryTxt);
          successesTxt = await getText(sftp, `${base}/Import_Successes_${gfFolder}.txt`);
          errorsTxt = await getText(sftp, `${base}/Import_Errors_${gfFolder}.txt`);
          await store(weeklyPath, env, LOG_CLEAN_NAMES.summary, summaryTxt, kept);
          if (successesTxt) await store(weeklyPath, env, LOG_CLEAN_NAMES.successes, successesTxt, kept);
          if (errorsTxt) await store(weeklyPath, env, LOG_CLEAN_NAMES.errors, errorsTxt, kept);
        } else {
          logger.info(`grants-feed log for ${date} not meaningful (nothing processed) — skipping.`);
        }
      } else {
        logger.info(`No grants-feed log folder for ${date} under ${gfParent}.`);
      }

      // ---- delete user links: <root>/<deleteUserLinks>/Log <date>_11-30-*/ ---
      delUserLinksTxt = await fetchNotes(sftp, `${dirs.root}/${dirs.deleteUserLinks}`, date, '11-30-');
      if (deleteUserLinksIsMeaningful(delUserLinksTxt)) {
        await store(weeklyPath, env, LOG_CLEAN_NAMES.deleteUserLinks, delUserLinksTxt, kept);
      } else if (delUserLinksTxt) {
        logger.info(`delete-user-links log for ${date} not meaningful (no outcomes) — skipping.`);
        delUserLinksTxt = '';
      }

      // ---- delete grant records (KFS archive): archive only ------------------
      const delGrantsTxt = await fetchNotes(sftp, `${dirs.root}/${dirs.deleteGrants}`, date, '11-00-');
      if (deleteGrantRecordsIsMeaningful(delGrantsTxt)) {
        await store(weeklyPath, env, LOG_CLEAN_NAMES.deleteGrantRecords, delGrantsTxt, kept);
      } else if (delGrantsTxt) {
        logger.info(`delete-grant-records log for ${date} not meaningful (0 deleted) — skipping.`);
      }
    } finally {
      try { await sftp.end(); } catch (_) { /* ignore */ }
      await cache.close();
    }

    // ---- load confirmation into reporting (best-effort) ----------------------
    const grantResults = (grantsSummary || successesTxt || errorsTxt)
      ? grantImportResults({ successes: successesTxt, errors: errorsTxt })
      : [];
    const dul = parseDeleteUserLinksNotes(delUserLinksTxt);
    const haveConfirmation = grantsSummary || grantResults.length || dul.outcomes.length;

    let reportingLoaded = false;
    if (haveConfirmation) {
      const summary = grantsSummary
        ? { ...grantsSummary, linksDeleted: dul.count, linksNotFound: dul.outcomes.filter(o => o.status === 'not-found').length }
        : null;
      reportingLoaded = await loadConfirmation({ env, yearWeek, logDate: date, grantResults, summary, deleteOutcomes: dul.outcomes });
    }

    console.log(JSON.stringify({
      env, date, yearWeek,
      archived: Object.keys(kept),
      grantResults: grantResults.length,
      deleteOutcomes: dul.outcomes.length,
      reportingLoaded
    }));
    process.exit();
  });

/** List a directory and return the first sub-folder name matching `pred`, or null. */
async function findFolder(sftp, parentDir, pred) {
  let entries;
  try { entries = await sftp.list(parentDir); }
  catch (_) { return null; }
  const hit = entries.find(e => e.type === 'd' && pred(e.name));
  return hit ? hit.name : null;
}

/** Download a remote text file as utf8, or '' if it is missing. */
async function getText(sftp, remotePath) {
  try {
    if (!(await sftp.exists(remotePath))) return '';
    const buf = await sftp.get(remotePath);
    return Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf);
  } catch (err) {
    logger.warn(`Could not fetch ${remotePath}: ${err.message}`);
    return '';
  }
}

/** Resolve `Log <date>_<hhmmPrefix>*` under parentDir and read notes_<date>.txt. */
async function fetchNotes(sftp, parentDir, date, hhmmPrefix) {
  const folder = await findFolder(sftp, parentDir, n => n.startsWith(`Log ${date}_${hhmmPrefix}`));
  if (!folder) {
    logger.info(`No log folder matching 'Log ${date}_${hhmmPrefix}*' under ${parentDir}.`);
    return '';
  }
  return getText(sftp, `${parentDir}/${folder}/notes_${date}.txt`);
}

async function store(weeklyPath, env, cleanName, text, kept) {
  await cache.write(symplecticLogPath(weeklyPath, env, cleanName), text);
  kept[cleanName] = true;
  logger.info(`Archived ${cleanName} -> ${symplecticLogPath(weeklyPath, env, cleanName)}`);
}

async function loadConfirmation(payload) {
  const pg = new PgClient(null, 'grant_feed');
  try {
    await pg.connect();
    const res = await loadImportConfirmation(pg, payload);
    logger.info('grant_feed confirmation loaded', res);
    return true;
  } catch (err) {
    logger.error(`grant_feed confirmation load failed (continuing): ${err.message}`);
    return false;
  } finally {
    try { await pg.end(); } catch (_) { /* ignore */ }
  }
}

program.parseAsync(process.argv).catch(err => {
  logger.error('grant-feed fetch-logs failed', err);
  process.exit(1);
});
