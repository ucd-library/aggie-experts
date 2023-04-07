#! /usr/bin/env node

import {Command} from 'commander';
const program = new Command();
import pkg from '../package.json' assert { type: "json" };
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
  .option('--fin <fin>', 'fin server','http://localhost:3000/')
  .hook('preSubcommand', (command, sub_command) => {
    process.env.EXPERTS_FIN = command.opts().fin;
  })

program
  .option('--iam-auth <key>', 'UC Davis IAM authentication key')
  .option('--iam-endpoint <endpoint>', 'UC Davis IAM endpoint', 'https://iet-ws-stage.ucdavis.edu/api/iam/people/profile/search?isFaculty=true')
  .hook('preSubcommand', (command, sub_command) => {
    process.env.EXPERTS_IAM_AUTH = command.opts().iamAuth;
    process.env.EXPERTS_IAM_ENDPOINT = command.opts().iamEndpoint;
  })

program
  .command('import', 'import data into aggie experts')
  .command('localdb', 'load/query local database')
//  .command('query', 'query aggie experts')
  .command('iam', 'hardcoded test')
  .command('build', 'build fcrepo files from linked data')

program.parse(process.argv);
