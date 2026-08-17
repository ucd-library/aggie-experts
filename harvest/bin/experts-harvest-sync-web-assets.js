#! /usr/bin/env -S node --no-warnings

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { logger, config } from '@ucd-lib/experts-commons';
import cache from '../lib/cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_FAQ_SOURCE = path.resolve(
  __dirname, '..', '..', 'webapp', 'spa', 'client', 'static-assets', 'faq', 'faq.md'
);

const program = new Command();

program
  .description('Sync a local static web asset (currently: the FAQ markdown) into CaskFS. ' +
    'Content-addressing makes repeat runs with unchanged content a cheap no-op, so this is safe to run on any schedule.')
  .option('-s, --source <path>', 'local markdown file to sync', DEFAULT_FAQ_SOURCE)
  .option('-d, --dest <path>', 'destination path in CaskFS', config.caskfs.faqPath)
  .action(async (opts) => {
    await cache.init();
    try {
      const markdown = await fs.readFile(opts.source, 'utf8');
      const result = await cache.write(opts.dest, markdown);
      logger.info(JSON.stringify({ status: 'ok', source: opts.source, dest: opts.dest, hash: result.hash }));
      process.exit(0);
    } catch (e) {
      logger.error(JSON.stringify({ status: 'error', message: e.message }));
      process.exit(1);
    } finally {
      await cache.close();
    }
  });

program.parse(process.argv);
