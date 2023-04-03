#! /usr/bin/env node

import {Command} from 'commander';
const program = new Command();
import pkg from '../../package.json' assert { type: "json" };

program
  .name('experts')
  .enablePositionalOptions()
  .version(pkg.version)
  .option('-v, --verbose', 'verbose output')
  .hook('preSubcommand', (command, sub_command) => {
    process.env.EXPERTS_VERBOSE = 1;
  })

program
  .option('--fin <fin>', 'fin server','http://localhost:3000/')
  .hook('preSubcommand', (command, sub_command) => {
    process.env.EXPERTS_FIN = command.opts().fin;
  })

program
  .command('import', 'import data into aggie experts')
//  .command('query', 'query aggie experts')
  .command('test', 'hardcoded test')

program.parse(process.argv);
