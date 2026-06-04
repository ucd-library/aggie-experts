#! /usr/bin/env -S node --no-warnings

import { Command } from 'commander';
import SlackNotifier from '@ucd-lib/experts-commons/lib/slack-notifier.js';
import {
  logger,
  config,
  Elasticsearch,
  patchWorkEsVisibility,
  patchWorkCdlVisibility,
  patchGrantEsVisibility,
  patchGrantCdlVisibility,
  patchExpertEsVisibility,
  patchExpertCdlVisibility,
  deleteExpert,
  deleteAuthorship,
  patchExpertAvailabilityEs,
  patchExpertAvailabilityCdl,
} from '@ucd-lib/experts-commons';

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
  .description('Update a work or grant record in Elasticsearch and/or CDL/Elements')
  .argument('<expert-id>', 'Expert ID (e.g. expert/abc123)')
  .argument('<relationship-id>', 'Relationship ARK ID (e.g. ark:/87287/d7mh2m/...)')
  .option('--type <work|grant>', 'Record type', 'work')
  .option('--elasticsearch <yes|no>', 'Update Elasticsearch', 'yes')
  .option('--cdl <yes|no>', 'Propagate to CDL/Elements', 'yes')
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

    if (!doEs && !doCdl) {
      logger.error('At least one of --elasticsearch or --cdl must be yes');
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
      logger.info(JSON.stringify({ status: 'ok', expertId, relationshipId, rejected: true }));
      return;
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

    if (doEs) await patchEs({ expertModel, patch, expertId, logger, config });
    if (doCdl) await patchCdl({ expertModel, patch, expertId, logger, config });

    logger.info(JSON.stringify({ status: 'ok', expertId, relationshipId, type }));
  });

update
  .command('expert')
  .description('Update an expert record in Elasticsearch and/or CDL/Elements')
  .argument('<expert-id>', 'Expert ID (e.g. expert/abc123)')
  .option('--elasticsearch <yes|no>', 'Update Elasticsearch', 'yes')
  .option('--cdl <yes|no>', 'Propagate to CDL/Elements', 'yes')
  .option('--visibility <yes|no>', 'Set visibility')
  .option('--delete <yes|no>', 'Delete the expert record')
  .action(async (expertId, opts) => {
    const doEs = parseYesNo(opts.elasticsearch, 'elasticsearch');
    const doCdl = parseYesNo(opts.cdl, 'cdl');
    const doDelete = opts.delete != null ? parseYesNo(opts.delete, 'delete') : false;

    if (!doEs && !doCdl) {
      logger.error('At least one of --elasticsearch or --cdl must be yes');
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
      return;
    }

    if (opts.visibility == null) {
      logger.error('--visibility is required');
      process.exit(1);
    }

    const patch = { visible: parseYesNo(opts.visibility, 'visibility') };

    if (doEs) await patchExpertEsVisibility({ expertModel, patch, expertId, logger, config });
    if (doCdl) await patchExpertCdlVisibility({ expertModel, patch, expertId, logger, config });

    logger.info(JSON.stringify({ status: 'ok', expertId }));
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
  });

program.addCommand(update);

program.parse(process.argv);
