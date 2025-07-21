import { Command } from 'commander';
import extract from '../lib/extract/index.js';

const program = new Command();
const env = process.env;

program.name('extract')
  .description('extract data for aggie experts from cdl & iam')
  .argument('<user-id>', 'User id to extract')
  .option('--force', 'Force extraction even if data already exists on disk')
  .option('--root-dir <root-dir>', 'Root directory for extracted data.  Respects env EXPERTS_ROOT_DIR')
  .action(async (user, options) => {
    extract.run({
      user: user,
      force: options.force,
      rootDir: options.rootDir
    });

  });

program.parse(process.argv);