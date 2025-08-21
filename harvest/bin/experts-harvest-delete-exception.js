import { Command } from 'commander';
import {setDeleteException, removeDeleteException} from '../lib/delete-exception.js';

const program = new Command();

program
  .command('set')
  .description('Set a delete exception for a user')
  .argument('<user-id>', 'User ID to set delete exception')
  .argument('<reason>', 'Reason for setting delete exception', '')
  .action(async (userId, reason) => {
    await setDeleteException(userId, reason);
  });

program
  .command('remove')
  .description('Remove a delete exception for a user')
  .argument('<user-id>', 'User ID to remove delete exception')
  .action(async (userId) => {
    await removeDeleteException(userId);
  });

program.parse(process.argv);