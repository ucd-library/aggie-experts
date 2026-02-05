import { Command } from 'commander';
import CdlClient from '../lib/extract/cdl.js';
import DagsterAPI from '../lib/dagster/api.js';
import logger from '../lib/logger.js';
import PgClient from '../lib/pg-client.js';
import config from '../lib/config.js';
import { getWeek } from 'date-fns';
const program = new Command();

const GROUP_IDS = ['dev', 'sandbox', 'experts'];

program
  .command('init-user-partitions')
  .argument('<group-id>', 'CDL group ID to initialize users from. Must be one of: '+GROUP_IDS.join(', '))
  .description('Create dynamic partitions in Dagster for each user in the specified CDL group')
  .action(async (groupId) => {
    if( !GROUP_IDS.includes(groupId) ) {
      throw new Error(`Invalid group ID specified.  Must be one of: ${GROUP_IDS.join(', ')}`);
    }

    const client = new CdlClient();
    const dagster = new DagsterAPI();
    const users = await client.getGroupList(groupId);

    // report users we see
    let pgClient;
    try {
      pgClient = new PgClient();
      await pgClient.connect();
      for( let user of users.users ) {
        await pgClient.insertCdlUser(user);
      }
    } catch (error) {
      logger.error('Error reporting users to database', { error: error.message });
    } finally {
      await pgClient.end();
    }

    await dagster.createDynamicPartitions(config.dagster.partitions.user, users.users);

    // things seem to hang after this point... so force exit
    process.exit();
  });

program
  .command('add-year-week-partition')
  .description('Create dynamic partitions in Dagster for each user in the specified CDL group')
  .option('--year-week <year-week>', 'Year-week to add partitions for (format: YYYY-WW).  Defaults to current week.', null)
  .action(async (opts) => {
    if( !opts.yearWeek ) {
      const date = new Date();
      let week = getWeek(date)+'';
      if( week.length === 1 ) week = '0'+week;
      opts.yearWeek = date.getFullYear()+'-'+week;
    }

    const client = new CdlClient();
    const dagster = new DagsterAPI();
    await dagster.createDynamicPartitions(config.dagster.partitionName, users.users);

    // things seem to hang after this point... so force exit
    process.exit();
  });

program
  .command('get-backfill-details')
  .argument('<backfill-id>', 'Dagster backfill ID to get details for')
  .description('Get details about a specific Dagster backfill')
  .action(async (backfillId) => {
    const dagster = new DagsterAPI();
    console.log(JSON.stringify(await dagster.getBackfillDetails(backfillId), null, 2));

    // things seem to hang after this point... so force exit
    process.exit();
  });

program
  .command('run-extract-users-job')
  .description('Trigger the weekly extract-users Dagster job on all partitions')
  .option('--group-id <group-id>', 'CDL group ID to initialize users from. Must be one of: '+GROUP_IDS.join(', '), GROUP_IDS[2])
  .option('--notify', 'Whether to send notifications for the backfill')
  .option('--continue-etl', 'Whether to continue to the ETL process after extraction')
  .option('--skip <count>', 'Number of users to skip from the start of the list')
  .option('--retries <count>', 'Number of times to retry failed steps', '2')
  .action(async (opts) => {
    const dagster = new DagsterAPI();

    const jobName = 'extract_users_job';
    const steps = ['extract_user', 'transform_user_standard'];
    
    console.log(`Starting backfill for job ${jobName} with ${steps.length} steps...`);

    // TODO: should we just read this from the database??
    const client = new CdlClient();
    const users = await client.getGroupList(opts.groupId);

    if( opts.skip ) {
      const skipCount = parseInt(opts.skip, 10);
      if( isNaN(skipCount) || skipCount < 0 ) {
        throw new Error('Invalid skip count specified: '+opts.skip);
      }
      users.users = users.users.slice(skipCount);
    }

    console.log(JSON.stringify(
      await dagster.startBackfill(jobName, steps, users.users, {
        'cdl_group_id': opts.groupId,
        'notify': opts.notify ? 'true' : 'false',
        'continue_etl': opts.continueEtl ? 'true' : 'false',
        'dagster/max_retries' : opts.retries
      }), 
      null, 2
    ));

    // things seem to hang after this point... so force exit
    process.exit();
  });

program
  .command('run-transform-load-users-job')
  .description('Trigger the transform-load-users Dagster job')
  .option('--notify', 'Whether to send notifications for the backfill')
  .option('--retries <count>', 'Number of times to retry failed steps', '2')
  .option('--partition-keys <keys>', 'Comma-separated list of partition keys to process.  Use "." for stdin', null)
  .action(async (opts) => {
    const dagster = new DagsterAPI();

    const jobName = 'transform_load_users_job';
    const steps = ['transform_user_webapp', 'load_user'];
    let tags = {
      'notify': opts.notify ? 'true' : 'false',
      'dagster/max_retries' : opts.retries
    };
    
    let partitionKeys = [];
    if( opts.partitionKeys ) {
      if( opts.partitionKeys === '.' ) {
        const stdin = await new Promise((resolve) => {
          let data = '';
          process.stdin.on('data', chunk => data += chunk);
          process.stdin.on('end', () => resolve(data));
        });
        partitionKeys = stdin.split(',').map(l => l.trim()).filter(l => l.length > 0);
      } else {
        partitionKeys = opts.partitionKeys.split(',').map(k => k.trim());
      }
    }

    console.log(partitionKeys);
    console.log(`Starting backfill for job ${jobName} with steps ${partitionKeys.length} partition keys...`);

    console.log(JSON.stringify(
      await dagster.startBackfill(jobName, steps, partitionKeys, tags), 
      null, 2
    ));

    // things seem to hang after this point... so force exit
    process.exit();
  });

// program
//   .command('remove-partition')
//   .argument('<key>', 'CDL group ID to remove users from')
//   .description('Remove dynamic partitions in Dagster for each user in the specified CDL group')
//   .action(async (key) => {
//     const dagster = new DagsterAPI();
//     console.log(await dagster.deleteDynamicPartitions(config.dagster.partitionName, [key]));
//   });

program.parse(process.argv);
