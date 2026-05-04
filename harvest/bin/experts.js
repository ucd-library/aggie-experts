#! /usr/bin/env -S node --no-warnings

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { config } from '@ucd-lib/experts-commons';

const program = new Command();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

program
  .name('experts')
  .enablePositionalOptions()
  .version(pkg.version)
  .option('-v, --verbose', 'verbose output')
  .hook('preSubcommand', (command, sub_command) => {
    process.env.EXPERTS_VERBOSE = 1;
  })

program
  .command('auth', 'run various authentication tasks')
  .command('es', 'run various ElasticSearch tasks')
  .command('harvest', 'run various harvest ETL tasks')  
  .command('miv-init', 'initialize miv postgres schema')
  .command('init', 'initialize aggie experts database components')

program 
  .command('build-version')
  .description('Print the current container build (from build metadata, not package.json)')
  .option('-v, --verbose', 'verbose output')
  .action((opts) => {
    if( opts.verbose ) {
      console.log(config.buildInfo);
      return;
    }
    console.log(config.getBuildVersion());
  });


program.parse(process.argv);
