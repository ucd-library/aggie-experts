import { Command } from 'commander';
import CdlClient from '../lib/extract/cdl.js';
import DagsterAPI from '../lib/dagster/api.js';
import { 
  getYearWeek,
  logger,
  config
} from '@ucd-lib/experts-commons';
import PgClient from '../lib/pg-client.js';
import cache from '../lib/cache.js';
import path from 'path';
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
      opts.yearWeek = getYearWeek();
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

    // // TODO: should we just read this from the database??
    // const client = new CdlClient();
    // const users = await client.getGroupList(opts.groupId);

    let userListPath = path.join(cache.getPath(), `users-list-${opts.groupId}.json`);
    let users = await cache.read(userListPath);
    users = JSON.parse(users).users;

    if( opts.skip ) {
      const skipCount = parseInt(opts.skip, 10);
      if( isNaN(skipCount) || skipCount < 0 ) {
        throw new Error('Invalid skip count specified: '+opts.skip);
      }
      users = users.slice(skipCount);
    }

    console.log(`Found ${users.length} users for group ${opts.groupId} at ${userListPath}. Starting backfill with these users as dynamic partitions...`);

    let resp = await dagster.startBackfill(jobName, steps, users, {
      'cdl_group_id': opts.groupId,
      'notify': opts.notify ? 'true' : 'false',
      'continue_etl': opts.continueEtl ? 'true' : 'false',
      'dagster/max_retries' : opts.retries
    });


    if( resp?.data?.launchPartitionBackfill?.__typename != 'LaunchBackfillSuccess' ) {
      console.error('Failed to start backfill', JSON.stringify(resp, null, 2));
      throw new Error('Failed to start backfill: '+jobName);
    }

    console.log(`Backfill started successfully with ID: ${resp.data.launchPartitionBackfill.backfillId}`);

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

program
  .command('remove-stale-user-partitions')
  .argument('<group-id>', 'CDL group ID to diff against. Must be one of: '+GROUP_IDS.join(', '))
  .description('Remove Dagster user partitions for users no longer in the CDL group. Defaults to dry-run; pass --yes to actually delete.')
  .option('--yes', 'Actually delete the stale partitions. Without this flag, the command is a dry-run.', false)
  .option('--reporting-job-id <job-id>', 'Dagster run ID to associate with reporting rows. Only recorded when --yes is also set.')
  .action(async (groupId, opts) => {
    if( !GROUP_IDS.includes(groupId) ) {
      throw new Error(`Invalid group ID specified.  Must be one of: ${GROUP_IDS.join(', ')}`);
    }

    const dagster = new DagsterAPI();
    const partitionsDefName = config.dagster.partitions.user;
    // Any asset using the 'users' DynamicPartitionsDefinition will return the
    // same set of partition keys; extract_user is the canonical one.
    const refAsset = 'extract_user';

    // Get current users list. Prefer the CaskFS-cached list for the current
    // year-week (written by init-user-partitions at the start of the week);
    // fall back to a live CDL fetch if it's missing.
    const userListPath = path.join(cache.getPath(), `users-list-${groupId}.json`);
    let currentUsers;
    let source;
    try {
      const raw = await cache.read(userListPath);
      currentUsers = JSON.parse(raw).users;
      source = `CaskFS ${userListPath}`;
    } catch (err) {
      console.log(`No cached user list at ${userListPath} (${err.message}). Falling back to live CDL fetch.`);
      const client = new CdlClient();
      const cdl = await client.getGroupList(groupId);
      currentUsers = cdl.users;
      source = `live CDL group ${groupId}`;
    }
    const cdlUsers = new Set(currentUsers);
    console.log(`Current user list (${source}) has ${cdlUsers.size} users.`);

    // Get current Dagster partitions.
    const dagsterPartitions = await dagster.getDynamicPartitionsForAsset(refAsset);
    console.log(`Dagster has ${dagsterPartitions.length} '${partitionsDefName}' partitions (via asset '${refAsset}').`);

    // Diff: in Dagster but not in CDL.
    const stale = dagsterPartitions.filter(p => !cdlUsers.has(p));

    if( stale.length === 0 ) {
      console.log('No stale partitions found. Nothing to do.');
      process.exit();
    }

    console.log(`Found ${stale.length} stale partition(s) (in Dagster, not in CDL group ${groupId}):`);
    for( const key of stale ) {
      console.log(`  - ${key}`);
    }

    if( !opts.yes ) {
      console.log('\nDry-run mode. Re-run with --yes to actually delete these partitions.');
      process.exit();
    }

    console.log(`\nDeleting ${stale.length} stale partition(s)...`);
    const resp = await dagster.deleteDynamicPartitions(partitionsDefName, stale);
    const result = resp?.data?.deleteDynamicPartitions;
    if( !result ) {
      console.error('Unexpected response from Dagster:', JSON.stringify(resp, null, 2));
      throw new Error('Failed to delete stale partitions');
    }
    if( result.message ) {
      console.error('Dagster error:', result.message);
      throw new Error('Failed to delete stale partitions: '+result.message);
    }
    console.log(`Deleted ${stale.length} stale partition(s) from '${result.partitionsDefName}'.`);

    // Record one reporting row per removed partition so the existing
    // etl_reporting views and dashboards pick this up alongside other
    // per-user commands. Only runs when --reporting-job-id is supplied
    // (i.e. when invoked from the Dagster asset).
    if( opts.reportingJobId ) {
      const weekYearInfo = getYearWeek({allValues: true, asString: true});
      const reportingOptions = {
        reason: 'not_in_cdl_group',
        group_id: groupId,
        source,
        partitions_def: partitionsDefName
      };

      let pgClient;
      try {
        pgClient = new PgClient();
        await pgClient.connect();
        for( const userId of stale ) {
          await pgClient.insertCommand({
            job_id: opts.reportingJobId,
            year_week: weekYearInfo.yearWeek,
            week_start: weekYearInfo.weekStart,
            command: 'experts-harvest-remove-partition',
            user_id: userId,
            options: reportingOptions
          });
        }
        console.log(`Recorded ${stale.length} 'experts-harvest-remove-partition' row(s) in etl_reporting.command.`);
      } catch (error) {
        logger.error('Error recording removed partitions to reporting db', { error: error.message });
      } finally {
        if( pgClient ) await pgClient.end();
      }
    }

    // things seem to hang after this point... so force exit
    process.exit();
  });

program.parse(process.argv);
