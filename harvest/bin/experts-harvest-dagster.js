import { Command } from 'commander';
import CdlClient from '../lib/extract/cdl.js';
import DagsterAPI from '../lib/dagster-api.js';
import config from '../lib/config.js';
const program = new Command();

const GROUP_IDS = ['dev', 'sandbox', 'experts'];

program
  .command('init-partitions')
  .argument('<group-id>', 'CDL group ID to initialize users from. Must be one of: '+GROUP_IDS.join(', '))
  .description('Create dynamic partitions in Dagster for each user in the specified CDL group')
  .action(async (groupId) => {
    if( !GROUP_IDS.includes(groupId) ) {
      throw new Error(`Invalid group ID specified.  Must be one of: ${GROUP_IDS.join(', ')}`);
    }

    const client = new CdlClient();
    const dagster = new DagsterAPI();
    const users = await client.getGroupList(groupId);
    await dagster.createDynamicPartitions(config.dagster.partitionName, users.users);

    // things seem to hang after this point... so force exit
    process.exit();
  });

program
  .command('remove-partition')
  .argument('<key>', 'CDL group ID to remove users from')
  .description('Remove dynamic partitions in Dagster for each user in the specified CDL group')
  .action(async (key) => {
    const dagster = new DagsterAPI();
    console.log(await dagster.deleteDynamicPartitions(config.dagster.partitionName, [key]));
  });

program.parse(process.argv);
