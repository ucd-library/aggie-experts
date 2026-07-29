#! /usr/bin/env -S node --no-warnings

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { config } from '@ucd-lib/experts-commons';
import SlackNotifier from '@ucd-lib/experts-commons/lib/slack-notifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_ORG_LOOKUP_PATH = path.resolve(
  __dirname, '..', '..', 'webapp', 'spa', 'client', 'public', 'lib', 'org-lookup.js'
);

function csvToOrgLookup(rows) {
  const categories = new Map();

  for (const row of rows) {
    const catLabel    = row['AE Filter Category']?.trim();
    const subCatLabel = row['AE Filter Sub Category']?.trim();
    const name        = row['Suggested Display Name']?.trim();
    const officialName = row['Official Name']?.trim();
    const deptCode    = String(row['Dept Code'] || '').trim();

    if (!catLabel || !subCatLabel || !name || !deptCode) continue;

    if (!categories.has(catLabel)) categories.set(catLabel, new Map());
    const subCats = categories.get(catLabel);

    if (!subCats.has(subCatLabel)) subCats.set(subCatLabel, []);
    subCats.get(subCatLabel).push({ name, officialName: officialName || '', deptCode });
  }

  return Array.from(categories.entries()).map(([label, subCats]) => ({
    label,
    subCategories: Array.from(subCats.entries()).map(([label, depts]) => ({
      label,
      depts,
    })),
  }));
}

const program = new Command();

program
  .name('admin')
  .description('Aggie Experts admin utilities');

program
  .command('notify')
  .description('Send a Slack notification')
  .requiredOption('--title <title>', 'Message title')
  .option('--message <message>', 'Message body', '')
  .option('--severity <severity>', 'Severity level: info, warning, or error', 'info')
  .option('--source <source>', 'Source label shown in the notification', 'dagster')
  .option('--context <key=value>', 'Context key/value pair (repeatable)', (val, acc) => {
    const [key, ...rest] = val.split('=');
    acc[key] = rest.join('=');
    return acc;
  }, {})
  .action(async (opts) => {
    const sent = await SlackNotifier.send({
      title: opts.title,
      message: opts.message,
      severity: opts.severity,
      source: opts.source,
      context: Object.keys(opts.context).length ? opts.context : null,
    });

    if (!sent) {
      process.exit(1);
    }

    process.exit();
  });

program
  .command('update-org-lookup')
  .description('Fetch the org lookup table from Google Sheets and write org-lookup.js')
  .option('--url <url>', 'Google Sheets CSV export URL (overrides config)', config.google.orgLookupSheetUrl)
  .option('--output <path>', 'Output file path', DEFAULT_ORG_LOOKUP_PATH)
  .option('--dry-run', 'Print the generated file to stdout instead of writing it')
  .action(async (opts) => {
    console.error(`Fetching org lookup from: ${opts.url}`);

    let csvText;
    try {
      // node-fetch follows redirects by default
      const { default: fetch } = await import('node-fetch');
      const res = await fetch(opts.url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      csvText = await res.text();
    } catch (err) {
      console.error(`Failed to fetch sheet: ${err.message}`);
      process.exit(1);
    }

    let rows;
    try {
      rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
    } catch (err) {
      console.error(`Failed to parse CSV: ${err.message}`);
      process.exit(1);
    }

    const orgLookup = csvToOrgLookup(rows);
    const output = `export const ORG_LOOKUP = ${JSON.stringify(orgLookup, null, 2)};\n`;

    if (opts.dryRun) {
      process.stdout.write(output);
    } else {
      await fs.ensureDir(path.dirname(opts.output));
      await fs.writeFile(opts.output, output, 'utf8');
      console.error(`Wrote ${orgLookup.length} categories to: ${opts.output}`);
    }

    process.exit(0);
  });

program.parse(process.argv);
