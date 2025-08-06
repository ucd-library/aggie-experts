#! /usr/bin/env -S node --no-warnings

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

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

// program
//   .option('--fin <fin>', 'fin server', 'http://localhost:3000/')
//   .hook('preSubcommand', (command, sub_command) => {
//     process.env.EXPERTS_FIN = command.opts().fin;
//   })

program
  .command('init', 'initialize aggie experts database components')
  .command('harvest', 'run various harvest ETL tasks')


program.parse(process.argv);
