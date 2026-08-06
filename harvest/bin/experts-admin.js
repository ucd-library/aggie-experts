#! /usr/bin/env -S node --no-warnings

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath, pathToFileURL } from 'url';
import { parse } from 'csv-parse/sync';
import { config } from '@ucd-lib/experts-commons';
import SlackNotifier from '@ucd-lib/experts-commons/lib/slack-notifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// commons/lib/org-lookup.js is the single source of truth: it is imported directly by the
// server (dept-utils / expandDeptParam) and the webapp build derives the client static asset
// (static-assets/org-lookup.json) from it.
const DEFAULT_ORG_LOOKUP_PATH = path.resolve(
  __dirname, '..', '..', 'commons', 'lib', 'org-lookup.js'
);

// Candidate sheet headers that carry a sub-category `key` (the stable short code used as the
// `dept` URL param value). The first non-empty match wins.
const KEY_COLUMNS = ['AE Filter Sub Category Key', 'AE Filter Key', 'Sub Category Key', 'Key'];

function getKeyFromRow(row) {
  for (const col of KEY_COLUMNS) {
    const v = row[col]?.trim();
    if (v) return v;
  }
  return '';
}

function csvToOrgLookup(rows) {
  const categories = new Map();

  for (const row of rows) {
    const catLabel    = row['AE Filter Category']?.trim();
    const subCatLabel = row['AE Filter Sub Category']?.trim();
    const name        = row['Suggested Display Name']?.trim();
    const officialName = row['Official Name']?.trim();
    const deptCode    = String(row['Dept Code'] || '').trim();
    const key         = getKeyFromRow(row);

    if (!catLabel || !subCatLabel || !name || !deptCode) continue;

    if (!categories.has(catLabel)) categories.set(catLabel, new Map());
    const subCats = categories.get(catLabel);

    if (!subCats.has(subCatLabel)) subCats.set(subCatLabel, { key: '', depts: [] });
    const sub = subCats.get(subCatLabel);
    if (key && !sub.key) sub.key = key;
    sub.depts.push({ name, officialName: officialName || '', deptCode });
  }

  return Array.from(categories.entries()).map(([label, subCats]) => ({
    label,
    subCategories: Array.from(subCats.entries()).map(([label, sub]) => ({
      label,
      key: sub.key,
      depts: sub.depts,
    })),
  }));
}

/**
 * Load the existing sub-category keys from the current org-lookup module, keyed by
 * "categoryLabel\u0000subCategoryLabel". Used to preserve keys the sheet doesn't carry —
 * keys are the stable `dept` URL param values, so they must not churn between regenerations.
 */
async function loadExistingKeys(outputPath) {
  const map = new Map();
  try {
    const mod = await import(pathToFileURL(outputPath).href);
    for (const cat of (mod.ORG_LOOKUP || [])) {
      for (const sub of (cat.subCategories || [])) {
        if (sub.key) map.set(`${cat.label}\u0000${sub.label}`, sub.key);
      }
    }
  } catch (e) {
    console.error(`Note: could not read existing keys from ${outputPath} (${e.code || e.message}); proceeding without preserved keys.`);
  }
  return map;
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

    // Preserve keys the sheet didn't supply from the existing file (keys are stable `dept`
    // URL param values and must not churn between regenerations).
    const existingKeys = await loadExistingKeys(opts.output);
    for (const cat of orgLookup) {
      for (const sub of cat.subCategories) {
        if (!sub.key) sub.key = existingKeys.get(`${cat.label}\u0000${sub.label}`) || '';
      }
    }

    // dept-utils URL serialization requires every sub-category to have a key — refuse to
    // write a file that would silently break previously-shared filter links.
    const missing = orgLookup
      .flatMap(cat => cat.subCategories.map(sub => ({ cat: cat.label, sub: sub.label, key: sub.key })))
      .filter(s => !s.key);
    if (missing.length) {
      console.error(`\nERROR: ${missing.length} sub-categor${missing.length === 1 ? 'y is' : 'ies are'} missing a "key" (required for dept URL serialization):`);
      for (const m of missing) console.error(`  - ${m.cat} > ${m.sub}`);
      console.error(`\nAdd a key column to the sheet (one of: ${KEY_COLUMNS.join(', ')}) or set the key in ${opts.output}, then re-run.`);
      if (!opts.dryRun) {
        console.error('Refusing to overwrite the existing file.');
        process.exit(1);
      }
    }

    // normalize object key order to {label, key, depts} regardless of how key was sourced
    const normalized = orgLookup.map(cat => ({
      label: cat.label,
      subCategories: cat.subCategories.map(sub => ({
        label: sub.label,
        ...(sub.key ? { key: sub.key } : {}),
        depts: sub.depts,
      })),
    }));
    const output = `export const ORG_LOOKUP = ${JSON.stringify(normalized, null, 2)};\n`;

    if (opts.dryRun) {
      process.stdout.write(output);
    } else {
      await fs.ensureDir(path.dirname(opts.output));
      await fs.writeFile(opts.output, output, 'utf8');
      const subCount = normalized.reduce((n, c) => n + c.subCategories.length, 0);
      console.error(`Wrote ${normalized.length} categories / ${subCount} sub-categories to: ${opts.output}`);
    }

    process.exit(0);
  });

program.parse(process.argv);
