import { Command } from 'commander';
import load from '../lib/load/index.js';
import logger from '../lib/logger.js';
import config from '../lib/config.js';

const program = new Command();
const env = process.env;

program.name('load')
  .description('load data for aggie experts into database(s)')
  .argument('<user-id>', 'User id to extract')
  .option('--reporting-job-id <job-id>', 'Job ID for reporting', env.EXPERTS_REPORTING_JOB_ID || 'default-job-id')
  .action(async (userId, options) => {
    if( !userId.match(/@/ ) ) {
      userId += '@ucdavis.edu';
    }

    if( options.reportingJobId ) {
      config.reporting.enabled = true;
      config.reporting.jobId = options.reportingJobId;
    }

    await load(userId);
  });

program.parse(process.argv);