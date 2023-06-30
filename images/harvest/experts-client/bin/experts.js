#! /usr/bin/env node

import { Command } from 'commander';
const program = new Command();
import pkg from '../package.json' assert { type: "json" };

program
  .name('experts')
  .enablePositionalOptions()
  .version(pkg.version)
  .option('-v, --verbose', 'verbose output')
  .hook('preSubcommand', (command, sub_command) => {
    process.env.EXPERTS_VERBOSE = 1;
  })

program
  .option('--fin <fin>', 'fin server', 'http://localhost:3000/')
  .hook('preSubcommand', (command, sub_command) => {
    process.env.EXPERTS_FIN = command.opts().fin;
  })

program
  .command('import', 'import data into aggie experts')
  .command('localdb', 'load/query local database')
  .command('splay', 'splay linked data into a directory structure')
  //  .command('query', 'query aggie experts')
  .command('iam', 'import profiles from IAM')
  .command('cdl', 'import profiles from IAM')
  .command('build', 'build fcrepo files from linked data')

program.parse(process.argv);


