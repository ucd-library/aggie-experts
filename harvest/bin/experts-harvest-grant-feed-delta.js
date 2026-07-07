#!/usr/bin/env node
/**
 * experts harvest grant-feed-delta
 *
 * Replaces the old grants-import/bin/experts-grant-feed-delta.js.
 * Reads two previously-generated generations of the grant-feed CSVs
 * and writes a `delta/` subdirectory containing:
 *
 *   {Prod_UCD_}grants_metadata.csv          (new + updated grants)
 *   {Prod_UCD_}grants_links.csv             (new/updated + linked-to-delta-grant)
 *   {Prod_UCD_}grants_persons.csv           (new + updated persons)
 *   {Prod_UCD_}delete_user_grants_links.csv (old links that vanished)
 *
 * The delta algorithm itself lives in ../lib/grant-feed/delta.js.
 */
import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { logger } from '@ucd-lib/experts-commons';
import {
  computeDelta,
  DELETE_LINK_HEADERS,
  METADATA_HEADERS,
  LINK_HEADERS,
  PERSON_HEADERS
} from '../lib/grant-feed/index.js';

const program = new Command();

program
  .name('experts-harvest-grant-feed-delta')
  .description('Compute the Symplectic delta between two grant-feed generations')
  .version('1.0.0')
  .option('--env <env>', 'QA | PROD (controls Prod_UCD_ filename prefix)', 'QA')
  .requiredOption('-o, --output <output>', 'Working directory containing generation-<N> subdirs')
  .requiredOption('-n, --new <new>', 'Generation id treated as the new feed')
  .requiredOption('-p, --prev <prev>', 'Generation id treated as the previous feed')
  .action(async (opts) => {
    const prefix = opts.env === 'PROD' ? 'Prod_UCD_' : '';
    const newDir = path.join(opts.output, `generation-${opts.new}`);
    const prevDir = path.join(opts.output, `generation-${opts.prev}`);
    const deltaDir = path.join(opts.output, 'delta');
    fs.mkdirSync(deltaDir, { recursive: true });

    const fn = name => `${prefix}${name}`;

    const newGrants = readCsv(path.join(newDir, fn('grants_metadata.csv')));
    const oldGrants = readCsv(path.join(prevDir, fn('grants_metadata.csv')));
    const newLinks = readCsv(path.join(newDir, fn('grants_links.csv')));
    const oldLinks = readCsv(path.join(prevDir, fn('grants_links.csv')));
    const newPersons = readCsv(path.join(newDir, fn('grants_persons.csv')));
    const oldPersons = readCsv(path.join(prevDir, fn('grants_persons.csv')));

    logger.info(`new: ${newGrants.length} grants / ${newLinks.length} links / ${newPersons.length} persons`);
    logger.info(`prev: ${oldGrants.length} grants / ${oldLinks.length} links / ${oldPersons.length} persons`);

    const { deltaGrants, deltaLinks, deltaPersons, deleteLinks } = computeDelta({
      newGrants, oldGrants,
      newLinks, oldLinks,
      newPersons, oldPersons
    });

    logger.info(`delta: ${deltaGrants.length} grants / ${deltaLinks.length} links / ${deltaPersons.length} persons / ${deleteLinks.length} deletes`);

    writeCsv(path.join(deltaDir, fn('grants_metadata.csv')), deltaGrants, METADATA_HEADERS);
    writeCsv(path.join(deltaDir, fn('grants_links.csv')), deltaLinks, LINK_HEADERS);
    writeCsv(path.join(deltaDir, fn('grants_persons.csv')), deltaPersons, PERSON_HEADERS);
    writeCsv(path.join(deltaDir, fn('delete_user_grants_links.csv')), deleteLinks, DELETE_LINK_HEADERS);
  });

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing expected input: ${filePath}`);
  }
  const data = fs.readFileSync(filePath, 'utf8');
  if (!data.trim()) return [];
  return parse(data, { columns: true, skip_empty_lines: true });
}

function writeCsv(filePath, rows, columns) {
  // LF line endings, matching the legacy delta files that were delivered to
  // Symplectic (the old delta script used csv-stringify's default '\n').
  const csv = stringify(rows, { header: true, columns, record_delimiter: '\n' });
  fs.writeFileSync(filePath, csv);
  logger.info(`Wrote ${filePath} (${rows.length} row(s))`);
}

program.parseAsync(process.argv).catch(err => {
  logger.error('grant-feed delta failed', err);
  process.exit(1);
});
