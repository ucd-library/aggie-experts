#!/usr/bin/env node
/**
 * experts harvest grant-feed transform
 *
 * Transform one week's Aggie Enterprise award XML into the three Symplectic
 * Elements import CSVs and store them in CasKFS under the weekly partition:
 *   /weekly/<year-week>/grant-feed/grants-{metadata,links,persons}.csv
 *
 * Cache filenames are clean (lower-case, hyphens); the legacy Prod_UCD_ names
 * are applied only on upload to Symplectic.
 *
 * Input resolution (first match wins):
 *   1. --xml <local path | gs://...>  explicit override (also archived into
 *      CasKFS as the week's raw ae-grants.xml)
 *   2. otherwise the raw ae-grants.xml already stored in CasKFS for the week
 *      (written by the email-check task)
 *
 * The parse + row-building lives in ../lib/grant-feed/transform.js; this CLI
 * only owns IO (CasKFS + optional GCS download).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Command } from 'commander';
import { Temporal } from '@js-temporal/polyfill';
import { logger, xmlToJson, getTodaysDate } from '@ucd-lib/experts-commons';
import cache from '../lib/cache.js';
import {
  buildAllRows,
  rowsToCsv,
  METADATA_HEADERS,
  LINK_HEADERS,
  PERSON_HEADERS,
  generationPath,
  rawInputPath,
  parseGsUri,
  listGenerations,
  downloadGeneration
} from '../lib/grant-feed/index.js';

const program = new Command();

program
  .name('transform')
  .description('Transform an AE grant XML feed into Symplectic CSVs, stored in CasKFS under the weekly partition')
  .option('-d, --date <date>', 'Week to store under (YYYY-MM-DD); defaults to today', null)
  .option('--xml <xml>', 'Optional input override: local path or gs://bucket/path/file.xml. If omitted, uses the raw ae-grants.xml already in CasKFS for the week.')
  .option('-g, --generation <generation>', 'When --xml is a gs:// URI, which GCS generation to pull (0 = most recent)', '0')
  .action(async (opts) => {
    try {
      const date = opts.date ? Temporal.PlainDate.from(opts.date) : getTodaysDate();
      const weeklyPath = cache.getPath({ root: '/weekly', date });
      const rawPath = rawInputPath(weeklyPath);

      const xml = await resolveXml(opts, rawPath);

      logger.info('Parsing XML -> JSON');
      const json = await xmlToJson(xml);

      logger.info('Building CSV rows');
      const { metadataRows, linkRows, personRows } = buildAllRows(json);
      logger.info(`Rows — metadata: ${metadataRows.length}, links: ${linkRows.length}, persons: ${personRows.length}`);

      // Clean, env-agnostic cache names. The Prod_UCD_ prefix is a Symplectic
      // upload concern, applied later via toSymplecticFileName().
      await cache.write(generationPath(weeklyPath, 'grants-metadata'), rowsToCsv(metadataRows, METADATA_HEADERS));
      await cache.write(generationPath(weeklyPath, 'grants-links'), rowsToCsv(linkRows, LINK_HEADERS));
      await cache.write(generationPath(weeklyPath, 'grants-persons'), rowsToCsv(personRows, PERSON_HEADERS));

      logger.info(`Wrote generation CSVs to ${weeklyPath}/grant-feed/`);
      console.log(JSON.stringify({
        weeklyPath,
        metadata: metadataRows.length,
        links: linkRows.length,
        persons: personRows.length
      }));
    } finally {
      await cache.close();
    }
    process.exit();
  });

/**
 * Resolve the XML string to transform. With --xml, read the override
 * (local or GCS) and archive it as the week's raw input in CasKFS. Without
 * --xml, read the raw input already stored in CasKFS for the week.
 */
async function resolveXml(opts, rawPath) {
  if (!opts.xml) {
    if (!(await cache.exists(rawPath))) {
      throw new Error(`No --xml provided and no raw input found in CasKFS at ${rawPath}`);
    }
    logger.info(`Reading raw input from CasKFS: ${rawPath}`);
    return cache.read(rawPath);
  }

  let xml;
  const gs = parseGsUri(opts.xml);
  if (gs) {
    const tmp = path.join(os.tmpdir(), gs.fileName);
    const gens = await listGenerations(gs.bucket, gs.filePath);
    const idx = parseInt(opts.generation, 10);
    if (gens.length === 0) throw new Error(`No generations of ${gs.filePath} in ${gs.bucket}`);
    if (idx >= gens.length) throw new Error(`Requested generation ${idx} but only ${gens.length} exist`);
    await downloadGeneration(gs.bucket, gs.filePath, tmp, gens[idx]);
    xml = fs.readFileSync(tmp, 'utf8');
    fs.rmSync(tmp, { force: true });
  } else {
    if (!fs.existsSync(opts.xml)) throw new Error(`XML not found at local path: ${opts.xml}`);
    xml = fs.readFileSync(opts.xml, 'utf8');
  }

  // Archive the input so the week's raw source is preserved alongside its CSVs.
  await cache.write(rawPath, xml);
  logger.info(`Archived raw input to CasKFS: ${rawPath}`);
  return xml;
}

program.parseAsync(process.argv).catch(err => {
  logger.error('grant-feed transform failed', err);
  process.exit(1);
});
