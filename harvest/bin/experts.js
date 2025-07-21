#! /usr/bin/env -S node --no-warnings

import { Command } from 'commander';
const program = new Command();
import pkg from '../package.json' with { type: "json" };

program
  .name('experts')
  .enablePositionalOptions()
  .version(pkg.version)
  .option('-v, --verbose', 'verbose output')
  .hook('preSubcommand', (command, sub_command) => {
    process.env.EXPERTS_VERBOSE = 1;
  })

// program
//   .option('--fin <fin>', 'fin server', 'http://localhost:3000/')
//   .hook('preSubcommand', (command, sub_command) => {
//     process.env.EXPERTS_FIN = command.opts().fin;
//   })

program
  .command('harvest', 'run various harvest ETL tasks')

program.parse(process.argv);
