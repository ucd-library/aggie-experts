#!/usr/bin/env node
/**
 * experts harvest grant-feed delta
 *
 * Compute the Symplectic delta between this week's grant-feed generation and
 * last week's, both read from CasKFS, and write the delta CSVs back to CasKFS:
 *
 *   /weekly/<year-week>/grant-feed/delta/grants-metadata.csv          (new + updated grants)
 *   /weekly/<year-week>/grant-feed/delta/grants-links.csv             (new/updated + linked-to-delta-grant)
 *   /weekly/<year-week>/grant-feed/delta/grants-persons.csv           (new + updated persons)
 *   /weekly/<year-week>/grant-feed/delta/delete-user-grants-links.csv (old links that vanished)
 *
 * "Last week" is the prior year-week partition. On the first-ever run there is
 * no prior generation, so every current row is treated as new (a full initial
 * load). The delta algorithm itself lives in ../lib/grant-feed/delta.js.
 */
import { Command } from 'commander';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { Temporal } from '@js-temporal/polyfill';
import { logger, getTodaysDate } from '@ucd-lib/experts-commons';
import cache from '../lib/cache.js';
import {
  computeDelta,
  DELETE_LINK_HEADERS,
  METADATA_HEADERS,
  LINK_HEADERS,
  PERSON_HEADERS,
  generationPath,
  deltaPath
} from '../lib/grant-feed/index.js';

const program = new Command();

program
  .name('delta')
  .description("Diff this week's grant-feed generation against last week's (both in CasKFS) and store the Symplectic delta")
  .option('-d, --date <date>', 'This week (YYYY-MM-DD); defaults to today.', null)
  .option('--prev-date <date>', 'Force the comparison week to the one containing this date (YYYY-MM-DD). Default: the most-recent prior week that has a generation in CasKFS.', null)
  .action(async (opts) => {
    try {
      // Use the app's timezone-aware "today" so this matches the year-week the
      // transform stage wrote to (getYearWeek defaults to getTodaysDate()).
      const thisWeekDate = opts.date ? Temporal.PlainDate.from(opts.date) : getTodaysDate();
      const thisWeek = cache.getPath({ root: '/weekly', date: thisWeekDate });

      // Determine the "previous" week to diff against:
      //   --prev-date  -> the week containing that date (explicit override), OR
      //   default      -> the most-recent week BEFORE this one that actually has
      //                   a generation in CasKFS (so a skipped/removed week is
      //                   stepped over, and a bad most-recent prior can be
      //                   skipped by removing it or pointing --prev-date past it).
      const prevWeek = opts.prevDate
        ? cache.getPath({ root: '/weekly', date: Temporal.PlainDate.from(opts.prevDate) })
        : await findPrevWeekWithGeneration(thisWeekDate);

      const newGrants = await readCsv(generationPath(thisWeek, 'grants-metadata'), { required: true });
      const newLinks = await readCsv(generationPath(thisWeek, 'grants-links'), { required: true });
      const newPersons = await readCsv(generationPath(thisWeek, 'grants-persons'), { required: true });

      // Previous week may not exist (first run) — treat as empty => full delta.
      const oldGrants = await readCsv(generationPath(prevWeek, 'grants-metadata'));
      const oldLinks = await readCsv(generationPath(prevWeek, 'grants-links'));
      const oldPersons = await readCsv(generationPath(prevWeek, 'grants-persons'));

      const hadPrev = oldGrants.length || oldLinks.length || oldPersons.length;
      if (!hadPrev) {
        logger.warn(`No prior generation found under ${prevWeek}/grant-feed/ — treating this as a full initial load.`);
      }

      logger.info(`new (${thisWeek}): ${newGrants.length} grants / ${newLinks.length} links / ${newPersons.length} persons`);
      logger.info(`prev (${prevWeek}): ${oldGrants.length} grants / ${oldLinks.length} links / ${oldPersons.length} persons`);

      const { deltaGrants, deltaLinks, deltaPersons, deleteLinks, newGrantIds } = computeDelta({
        newGrants, oldGrants,
        newLinks, oldLinks,
        newPersons, oldPersons
      });

      logger.info(`delta: ${deltaGrants.length} grants (${newGrantIds.length} new) / ${deltaLinks.length} links / ${deltaPersons.length} persons / ${deleteLinks.length} deletes`);

      await writeCsv(deltaPath(thisWeek, 'grants-metadata'), deltaGrants, METADATA_HEADERS);
      await writeCsv(deltaPath(thisWeek, 'grants-links'), deltaLinks, LINK_HEADERS);
      await writeCsv(deltaPath(thisWeek, 'grants-persons'), deltaPersons, PERSON_HEADERS);
      await writeCsv(deltaPath(thisWeek, 'delete-user-grants-links'), deleteLinks, DELETE_LINK_HEADERS);

      console.log(JSON.stringify({
        weeklyPath: thisWeek,
        prevWeek,
        firstLoad: !hadPrev,
        grants: deltaGrants.length,
        links: deltaLinks.length,
        persons: deltaPersons.length,
        deletes: deleteLinks.length,
        // grant_ids new this week (absent from last week's generation), so the
        // reporting load can classify new vs updated without re-reading it.
        newGrantIds
      }));
    } finally {
      await cache.close();
    }
    process.exit();
  });

// How many weeks back to scan for a prior generation. Weekly cleanup keeps only
// the last ~5 weeks, so 8 is a safe margin; if none is found the delta is a full
// initial load.
const MAX_PREV_LOOKBACK = 8;

/**
 * Find the most-recent week BEFORE thisWeekDate whose grants-metadata generation
 * exists in CasKFS. Falls back to the immediately-prior week (empty -> full
 * load) if none is found within the lookback.
 */
async function findPrevWeekWithGeneration(thisWeekDate) {
  for (let w = 1; w <= MAX_PREV_LOOKBACK; w++) {
    const wk = cache.getPath({ root: '/weekly', date: thisWeekDate.subtract({ weeks: w }) });
    if (await cache.exists(generationPath(wk, 'grants-metadata'))) return wk;
  }
  return cache.getPath({ root: '/weekly', date: thisWeekDate.subtract({ weeks: 1 }) });
}

async function readCsv(assetPath, { required = false } = {}) {
  if (!(await cache.exists(assetPath))) {
    if (required) throw new Error(`Missing expected CasKFS input: ${assetPath}`);
    return [];
  }
  const data = await cache.read(assetPath);
  if (!data || !data.trim()) return [];
  return parse(data, { columns: true, skip_empty_lines: true });
}

async function writeCsv(assetPath, rows, columns) {
  // LF line endings, matching the legacy delta files delivered to Symplectic
  // (the old delta script used csv-stringify's default '\n').
  const csv = stringify(rows, { header: true, columns, record_delimiter: '\n' });
  await cache.write(assetPath, csv);
  logger.info(`Wrote ${assetPath} (${rows.length} row(s))`);
}

program.parseAsync(process.argv).catch(err => {
  logger.error('grant-feed delta failed', err);
  process.exit(1);
});
