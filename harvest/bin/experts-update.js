import { Command } from 'commander';
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
} from '@ucd-lib/experts-commons';

const program = new Command();

function parseYesNo(value, flag) {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  logger.error(`--${flag} must be 'yes' or 'no', got: ${value}`);
  process.exit(1);
}

async function buildExpertModel() {
  await Elasticsearch.initClient();
  return { client: Elasticsearch.client, UPDATE_RETRY_COUNT: 3 };
}

program
  .command('scholarly-record')
  .description('Update a work or grant record in Elasticsearch and/or CDL/Elements')
  .argument('<expert-id>', 'Expert ID (e.g. expert/abc123)')
  .argument('<record-id>', 'Record ARK ID (work: ark:/87287/d7mh2m/publication/..., grant: ark:/87287/d7mh2m/relationship/...)')
  .option('--type <work|grant>', 'Record type', 'work')
  .option('--elasticsearch <yes|no>', 'Update Elasticsearch', 'yes')
  .option('--cdl <yes|no>', 'Propagate to CDL/Elements', 'yes')
  .option('--visibility <yes|no>', 'Set visibility')
  .option('--favorite <yes|no>', 'Set as favorite (works only)')
  .action(async (expertId, recordId, opts) => {
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

    const patch = { '@id': recordId };
    if (opts.visibility != null) patch.visible = parseYesNo(opts.visibility, 'visibility');
    if (opts.favorite != null) patch.favourite = parseYesNo(opts.favorite, 'favorite');

    if (!('visible' in patch) && !('favourite' in patch)) {
      logger.error('At least one of --visibility or --favorite must be provided');
      process.exit(1);
    }

    const expertModel = await buildExpertModel();
    const patchEs = isWork ? patchWorkEsVisibility : patchGrantEsVisibility;
    const patchCdl = isWork ? patchWorkCdlVisibility : patchGrantCdlVisibility;

    if (doEs) await patchEs({ expertModel, patch, expertId, logger, config });
    if (doCdl) await patchCdl({ expertModel, patch, expertId, logger, config });
  });

program
  .command('expert')
  .description('Update an expert record in Elasticsearch and/or CDL/Elements')
  .argument('<expert-id>', 'Expert ID (e.g. expert/abc123)')
  .option('--elasticsearch <yes|no>', 'Update Elasticsearch', 'yes')
  .option('--cdl <yes|no>', 'Propagate to CDL/Elements', 'yes')
  .option('--visibility <yes|no>', 'Set visibility')
  .action(async (expertId, opts) => {
    const doEs = parseYesNo(opts.elasticsearch, 'elasticsearch');
    const doCdl = parseYesNo(opts.cdl, 'cdl');

    if (!doEs && !doCdl) {
      logger.error('At least one of --elasticsearch or --cdl must be yes');
      process.exit(1);
    }

    if (opts.visibility == null) {
      logger.error('--visibility is required');
      process.exit(1);
    }

    const patch = { visible: parseYesNo(opts.visibility, 'visibility') };
    const expertModel = await buildExpertModel();

    if (doEs) await patchExpertEsVisibility({ expertModel, patch, expertId, logger, config });
    if (doCdl) await patchExpertCdlVisibility({ expertModel, patch, expertId, logger, config });
  });

program.parse(process.argv);
