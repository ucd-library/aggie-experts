import { Command } from 'commander';
import CdlClient from '../lib/extract/cdl.js';
import DagsterAPI from '../lib/dagster-api.js';
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

// program
//   .command('remove-partition')
//   .argument('<key>', 'CDL group ID to remove users from')
//   .description('Remove dynamic partitions in Dagster for each user in the specified CDL group')
//   .action(async (key) => {
//     const dagster = new DagsterAPI();
//     console.log(await dagster.deleteDynamicPartitions(config.dagster.partitionName, [key]));
//   });

program.parse(process.argv);
