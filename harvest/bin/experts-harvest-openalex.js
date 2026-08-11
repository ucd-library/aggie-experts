#! /usr/bin/env -S node --no-warnings

import { Command } from 'commander';
import { openDb } from '../lib/openalex/db.js';
import { loadTopicsFromCsv } from '../lib/openalex/topics.js';
import { extractExpertsAndWorks } from '../lib/openalex/extract.js';
import { fetchMissingTopics } from '../lib/openalex/fetch.js';
import { buildWorkTopics } from '../lib/openalex/build.js';

const program = new Command();

const DEFAULT_DB = './openalex-experts.sqlite';
const DEFAULT_MAILTO = process.env.OPENALEX_MAILTO || 'mngrow@ucdavis.edu';
const DEFAULT_API_KEY = process.env.OPENALEX_API_KEY;

function withDbOption(cmd) {
  return cmd.option('--db <path>', 'Path to the output SQLite database', DEFAULT_DB);
}

function withFetchOptions(cmd) {
  return cmd
    .option('--mailto <email>', 'Email to use for the OpenAlex polite pool', DEFAULT_MAILTO)
    .option('--api-key <key>', 'OpenAlex API key (takes precedence over --mailto when set)', DEFAULT_API_KEY)
    .option('--limit <n>', 'Limit number of DOIs to fetch (for testing)', v => parseInt(v, 10))
    .option('--delay-ms <ms>', 'Delay between OpenAlex requests, in milliseconds', v => parseInt(v, 10), 110)
    .option('--concurrency <n>', 'Number of DOIs to fetch in parallel', v => parseInt(v, 10), 10)
    .option('--force', 'Re-fetch DOIs even if already cached', false);
}

withDbOption(program.command('topics'))
  .description('load/refresh the topic->subfield->field->domain reference table from the OpenAlex topic mapping CSV')
  .requiredOption('--csv <path>', 'path to the OpenAlex topic mapping CSV')
  .action(async (opts) => {
    const db = openDb(opts.db);
    await loadTopicsFromCsv(db, opts.csv);
    db.close();
  });

withDbOption(program.command('extract'))
  .description('extract expert/work/DOI rows from the harvest postgres database')
  .action(async (opts) => {
    const db = openDb(opts.db);
    await extractExpertsAndWorks(db);
    db.close();
  });

withFetchOptions(withDbOption(program.command('fetch')))
  .description('fetch OpenAlex topic data for DOIs not yet cached')
  .action(async (opts) => {
    const db = openDb(opts.db);
    await fetchMissingTopics(db, {
      mailto: opts.mailto,
      apiKey: opts.apiKey,
      limit: opts.limit,
      delayMs: opts.delayMs,
      concurrency: opts.concurrency,
      force: opts.force
    });
    db.close();
  });

withDbOption(program.command('build'))
  .description('join cached OpenAlex responses with extracted works/experts and rebuild the flattened dataset view')
  .action(async (opts) => {
    const db = openDb(opts.db);
    await buildWorkTopics(db);
    db.close();
  });

withFetchOptions(withDbOption(program.command('run')))
  .description('run extract -> fetch -> build in sequence (pass --csv to also load/refresh the topic table first)')
  .option('--csv <path>', 'path to the OpenAlex topic mapping CSV (loads/refreshes topic table before extracting)')
  .action(async (opts) => {
    const db = openDb(opts.db);
    if (opts.csv) {
      await loadTopicsFromCsv(db, opts.csv);
    }
    await extractExpertsAndWorks(db);
    await fetchMissingTopics(db, {
      mailto: opts.mailto,
      apiKey: opts.apiKey,
      limit: opts.limit,
      delayMs: opts.delayMs,
      concurrency: opts.concurrency,
      force: opts.force
    });
    await buildWorkTopics(db);
    db.close();
  });

program.parse(process.argv);
