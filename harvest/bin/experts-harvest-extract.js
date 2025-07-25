import { Command } from 'commander';
import extract from '../lib/extract/index.js';
import logger from '../lib/logger.js';
import config from '../lib/config.js';

const program = new Command();
const env = process.env;

program.name('extract')
  .description('extract data for aggie experts from cdl & iam')
  .argument('<user-id>', 'User id to extract')
  .option('--force', 'Force extraction even if data already exists on disk')
  .option('--root-dir <root-dir>', 'Root directory for extracted data.  Respects env EXPERTS_ROOT_DIR')
  .option('--reporting-job-id <job-id>', 'Job ID for reporting', env.EXPERTS_REPORTING_JOB_ID || 'default-job-id')
  .action(async (user, options) => {
    if( options.reportingJobId ) {
      config.reporting.enabled = true;
      config.reporting.jobId = options.reportingJobId;
    }

    let resp = await extract.run({
      user: user,
      force: options.force,
      rootDir: options.rootDir
    });

    logger.info('Extraction complete for user', user, { 
      files : [resp.iam, ...resp.cdl] 
    });
  });

program.parse(process.argv);