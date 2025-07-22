import { Command } from 'commander';
import CdlClient from '../lib/extract/cdl.js';
import logger from '../lib/logger.js';

const program = new Command();
const env = process.env;

program.name('list-users')
  .argument('<group-id>')
  .description('list users from CDL group')
  .action(async (groupId) => {
    const client = new CdlClient();
    const users = await client.getGroupList(groupId);
    logger.info({
      groupId: users.groupId,
      groupName: users.groupName,
      cachePath: users.cachePath
    })
  });

program.parse(process.argv);