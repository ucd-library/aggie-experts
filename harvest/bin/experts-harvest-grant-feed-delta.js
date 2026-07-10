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
  .option('-d, --date <date>', 'This week (YYYY-MM-DD); defaults to today. The previous year-week is derived from the app\'s Saturday-aligned week logic.', null)
  .action(async (opts) => {
    try {
      // Use the app's timezone-aware "today" so this matches the year-week the
      // transform stage wrote to (getYearWeek defaults to getTodaysDate()).
      const thisWeekDate = opts.date ? Temporal.PlainDate.from(opts.date) : getTodaysDate();

      // Previous year-week: subtract one week (7 days) then map through the
      // year-week logic. This mirrors how the reporting DB finds last week
      // (get_year_week(NOW() - INTERVAL '7 days')) and the `year-week
      // --weeks-ago` CLI; cache.getPath -> getYearWeek handles the
      // Saturday-aligned boundaries and year rollovers.
      const prevWeekDate = thisWeekDate.subtract({ weeks: 1 });

      const thisWeek = cache.getPath({ root: '/weekly', date: thisWeekDate });
      const prevWeek = cache.getPath({ root: '/weekly', date: prevWeekDate });

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

      const { deltaGrants, deltaLinks, deltaPersons, deleteLinks } = computeDelta({
        newGrants, oldGrants,
        newLinks, oldLinks,
        newPersons, oldPersons
      });

      logger.info(`delta: ${deltaGrants.length} grants / ${deltaLinks.length} links / ${deltaPersons.length} persons / ${deleteLinks.length} deletes`);

      await writeCsv(deltaPath(thisWeek, 'grants-metadata'), deltaGrants, METADATA_HEADERS);
      await writeCsv(deltaPath(thisWeek, 'grants-links'), deltaLinks, LINK_HEADERS);
      await writeCsv(deltaPath(thisWeek, 'grants-persons'), deltaPersons, PERSON_HEADERS);
      await writeCsv(deltaPath(thisWeek, 'delete-user-grants-links'), deleteLinks, DELETE_LINK_HEADERS);

      console.log(JSON.stringify({
        weeklyPath: thisWeek,
        firstLoad: !hadPrev,
        grants: deltaGrants.length,
        links: deltaLinks.length,
        persons: deltaPersons.length,
        deletes: deleteLinks.length
      }));
    } finally {
      await cache.close();
    }
    process.exit();
  });

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
