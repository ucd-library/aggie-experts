#! /usr/bin/env -S node --no-warnings

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath, pathToFileURL } from 'url';
import { parse } from 'csv-parse/sync';
import SlackNotifier from '@ucd-lib/experts-commons/lib/slack-notifier.js';
import {
  logger,
  config,
  Elasticsearch,
  patchWorkEsVisibility,
  patchWorkCdlVisibility,
  patchWorkPgVisibility,
  patchGrantEsVisibility,
  patchGrantCdlVisibility,
  patchGrantPgVisibility,
  patchExpertEsVisibility,
  patchExpertCdlVisibility,
  patchExpertPgVisibility,
  deleteExpert,
  deleteAuthorship,
  patchExpertAvailabilityEs,
  patchExpertAvailabilityCdl,
} from '@ucd-lib/experts-commons';
import PgClient from '../lib/pg-client.js';

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

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * @function parseYesNo
 * @description parse a yes/no string option into a boolean, exiting on invalid input
 *
 * @param {String} value option value
 * @param {String} flag flag name used in error messages
 * @returns {Boolean}
 */
function parseYesNo(value, flag) {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  logger.error(`--${flag} must be 'yes' or 'no', got: ${value}`);
  process.exit(1);
}

/**
 * @function buildExpertModel
 * @description initialise the Elasticsearch client and return a minimal expert model object
 *
 * @returns {Promise<Object>} object with client and UPDATE_RETRY_COUNT
 */
async function buildExpertModel() {
  await Elasticsearch.initClient();
  return { client: Elasticsearch.client, UPDATE_RETRY_COUNT: 3 };
}

// ---------------------------------------------------------------------------
// notify
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

const update = new Command('update')
  .description('Update records in Elasticsearch and/or CDL/Elements');

update
  .command('scholarly-record')
  .description('Update a work or grant record in Elasticsearch, CDL/Elements, and/or Postgres')
  .argument('<expert-id>', 'Expert ID (e.g. expert/abc123)')
  .argument('<relationship-id>', 'Relationship ARK ID (e.g. ark:/87287/d7mh2m/...)')
  .option('--type <work|grant>', 'Record type', 'work')
  .option('--elasticsearch <yes|no>', 'Update Elasticsearch', 'yes')
  .option('--cdl <yes|no>', 'Propagate to CDL/Elements', 'yes')
  .option('--postgres <yes|no>', 'Update Postgres', 'yes')
  .option('--visibility <yes|no>', 'Set visibility')
  .option('--favorite <yes|no>', 'Set as favorite (works only)')
  .option('--reject <yes|no>', 'Reject/delete authorship (works only)')
  .action(async (expertId, relationshipId, opts) => {
    const type = opts.type;
    if (type !== 'work' && type !== 'grant') {
      logger.error(`--type must be 'work' or 'grant', got: ${type}`);
      process.exit(1);
    }

    const isWork = type === 'work';
    const doEs = parseYesNo(opts.elasticsearch, 'elasticsearch');
    const doCdl = parseYesNo(opts.cdl, 'cdl');
    const doPg = parseYesNo(opts.postgres, 'postgres');

    if (!doEs && !doCdl && !doPg) {
      logger.error('At least one of --elasticsearch, --cdl, or --postgres must be yes');
      process.exit(1);
    }

    if (!isWork && opts.favorite != null) {
      logger.error('--favorite is not applicable to grants');
      process.exit(1);
    }

    if (!isWork && opts.reject != null) {
      logger.error('--reject is not applicable to grants');
      process.exit(1);
    }

    const doReject = opts.reject != null ? parseYesNo(opts.reject, 'reject') : false;

    if (doReject) {
      if (opts.visibility != null || opts.favorite != null) {
        logger.error('--reject is mutually exclusive with --visibility and --favorite');
        process.exit(1);
      }
      const expertModel = await buildExpertModel();
      const origPropagate = config.experts.cdl.authorship.propagate;
      config.experts.cdl.authorship.propagate = doCdl;
      try {
        await deleteAuthorship({ expertModel, id: relationshipId, expertId, logger, config });
      } finally {
        config.experts.cdl.authorship.propagate = origPropagate;
      }
      if (doPg) {
        const pgClient = new PgClient();
        try {
          const rid = relationshipId.replace('ark:/87287/d7mh2m/', 'ark:/87287/d7mh2m/relationship/');
          await pgClient.query(
            `DELETE FROM api.expert_work_role WHERE role_id = $1 AND expert_id = $2`,
            [rid, expertId.replace('expert/', '')]
          );
        } finally {
          await pgClient.end();
        }
      }
      logger.info(JSON.stringify({ status: 'ok', expertId, relationshipId, rejected: true }));
      process.exit(0);
    }

    const patch = { '@id': relationshipId };
    if (opts.visibility != null) patch.visible = parseYesNo(opts.visibility, 'visibility');
    if (opts.favorite != null) patch.favourite = parseYesNo(opts.favorite, 'favorite');

    if (!('visible' in patch) && !('favourite' in patch)) {
      logger.error('At least one of --visibility, --favorite, or --reject must be provided');
      process.exit(1);
    }

    const expertModel = await buildExpertModel();
    const patchEs = isWork ? patchWorkEsVisibility : patchGrantEsVisibility;
    const patchCdl = isWork ? patchWorkCdlVisibility : patchGrantCdlVisibility;
    const patchPg = isWork ? patchWorkPgVisibility : patchGrantPgVisibility;

    const errors = [];

    if (doEs) {
      try {
        await patchEs({ expertModel, patch, expertId, logger, config });
      } catch (e) {
        logger.error({ error: e.message }, `Elasticsearch update failed for ${expertId}`);
        errors.push({ step: 'elasticsearch', message: e.message });
      }
    }

    if (doCdl) {
      try {
        await patchCdl({ expertModel, patch, expertId, logger, config });
      } catch (e) {
        logger.error({ error: e.message }, `CDL update failed for ${expertId}`);
        errors.push({ step: 'cdl', message: e.message });
      }
    }

    if (doPg) {
      const pgClient = new PgClient();
      try {
        await patchPg({ pgClient, patch, expertId, logger });
      } catch (e) {
        logger.error({ error: e.message }, `Postgres update failed for ${expertId}`);
        errors.push({ step: 'postgres', message: e.message });
      } finally {
        await pgClient.end();
      }
    }

    if (errors.length > 0) {
      logger.error(JSON.stringify({ status: 'error', expertId, relationshipId, type, errors }));
      process.exit(1);
    }

    logger.info(JSON.stringify({ status: 'ok', expertId, relationshipId, type }));
    process.exit(0);
  });

update
  .command('expert')
  .description('Update an expert record in Elasticsearch, CDL/Elements, and/or Postgres')
  .argument('<expert-id>', 'Expert ID (e.g. expert/abc123)')
  .option('--elasticsearch <yes|no>', 'Update Elasticsearch', 'yes')
  .option('--cdl <yes|no>', 'Propagate to CDL/Elements', 'yes')
  .option('--postgres <yes|no>', 'Update Postgres', 'yes')
  .option('--visibility <yes|no>', 'Set visibility')
  .option('--delete <yes|no>', 'Delete the expert record')
  .action(async (expertId, opts) => {
    const doEs = parseYesNo(opts.elasticsearch, 'elasticsearch');
    const doCdl = parseYesNo(opts.cdl, 'cdl');
    const doPg = parseYesNo(opts.postgres, 'postgres');
    const doDelete = opts.delete != null ? parseYesNo(opts.delete, 'delete') : false;

    if (!doEs && !doCdl && !doPg) {
      logger.error('At least one of --elasticsearch, --cdl, or --postgres must be yes');
      process.exit(1);
    }

    if (doDelete && opts.visibility != null) {
      logger.error('--delete and --visibility are mutually exclusive');
      process.exit(1);
    }

    const expertModel = await buildExpertModel();

    if (doDelete) {
      const origPropagate = config.experts.cdl.expert.propagate;
      config.experts.cdl.expert.propagate = doCdl;
      try {
        await deleteExpert({ expertModel, expertId, logger, config });
      } finally {
        config.experts.cdl.expert.propagate = origPropagate;
      }
      logger.info(JSON.stringify({ status: 'ok', expertId, deleted: true }));
      process.exit(0);
    }

    if (opts.visibility == null) {
      logger.error('--visibility is required');
      process.exit(1);
    }

    const patch = { visible: parseYesNo(opts.visibility, 'visibility') };

    if (doEs) await patchExpertEsVisibility({ expertModel, patch, expertId, logger, config });
    if (doCdl) await patchExpertCdlVisibility({ expertModel, patch, expertId, logger, config });
    if (doPg) {
      const pgClient = new PgClient();
      try {
        await patchExpertPgVisibility({ pgClient, patch, expertId, logger });
      } finally {
        await pgClient.end();
      }
    }

    logger.info(JSON.stringify({ status: 'ok', expertId }));
    process.exit(0);
  });

update
  .command('availability')
  .description('Update expert availability labels in Elasticsearch and/or CDL/Elements')
  .argument('<expert-id>', 'Expert ID (e.g. expert/abc123)')
  .option('--elasticsearch <yes|no>', 'Update Elasticsearch', 'yes')
  .option('--cdl <yes|no>', 'Propagate to CDL/Elements', 'yes')
  .option('--labels-to-add <json>', 'JSON array of labels to add or edit', '[]')
  .option('--labels-to-remove <json>', 'JSON array of labels to remove', '[]')
  .option('--current-labels <json>', 'JSON array of current labels', '[]')
  .action(async (expertId, opts) => {
    const doEs = parseYesNo(opts.elasticsearch, 'elasticsearch');
    const doCdl = parseYesNo(opts.cdl, 'cdl');

    if (!doEs && !doCdl) {
      logger.error('At least one of --elasticsearch or --cdl must be yes');
      process.exit(1);
    }

    let labelsToAddOrEdit, labelsToRemove, currentLabels;
    try {
      labelsToAddOrEdit = JSON.parse(opts.labelsToAdd);
      labelsToRemove = JSON.parse(opts.labelsToRemove);
      currentLabels = JSON.parse(opts.currentLabels);
    } catch (e) {
      logger.error(`Failed to parse labels JSON: ${e.message}`);
      process.exit(1);
    }

    const data = { labelsToAddOrEdit, labelsToRemove, currentLabels };
    const expertModel = await buildExpertModel();

    if (doEs) await patchExpertAvailabilityEs({ expertModel, data, expertId, logger, config });
    if (doCdl) await patchExpertAvailabilityCdl({ expertModel, data, expertId, logger, config });

    logger.info(JSON.stringify({ status: 'ok', expertId }));
    process.exit(0);
  });

program.addCommand(update);

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
