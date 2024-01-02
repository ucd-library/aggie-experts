#! /usr/bin/env -S node --no-warnings

'use strict';
import { Command } from '../lib/experts-commander.js';
import Cache from '../lib/cache.js';
import { logger } from '../lib/logger.js';
import { performance } from 'node:perf_hooks';

const program = new Command();
const commands=['enqueue', 'dequeue', 'queue', 'invalidate', 'list', 'process'];

async function main(opt) {

  let command=[];
  commands.forEach(c => {
    if (opt[c]) {
      command.push(c);
    }
  });
  if (command.length > 1) {
    let l=command.map(c => '--' + c).join(' ');
    logger.error(`Only one command allowed: ${l} specified`);
    process.exit(1);
  } else if (command.length == 0) {
    let l=commands.map(c => '--' + c).join(' ');
    logger.error('No command specified: one of ' + l + ' required');
    process.exit(1);
  } else {
    command = command[0];
  }

  const cache= new Cache(opt);

  switch (command) {
  case 'enqueue':
    await cache.queue().enqueue(program.args);
    break;
  case 'dequeue':
    await cache.queue().dequeue(program.args);
    break;
  case 'queue':
    await cache.queue().list(program.args);
    break;
  case 'invalidate':
    await cache.invalidate(program.args);
    break;
  case 'list':
    await cache.list(program.args);
    break;
  case 'process':
    await cache.process(program.args);
    break;
  }
}

performance.mark('start');
program.name('cdl-cache')
  .usage('[options] [--enqueue|--dequeue|--queue|--list|--invalidate|--process] <users...>')
  .description('CDL Researcher Profile Cache and Queue Management')
  .option('--default-domain','default university domain','ucdavis.edu')
  .option('--deprioritize','allow an enqueue request to reduce an experts priority',false)
  .option('--dequeue','remove expert(s) from the queue')
  .option('--enqueue', 'enqueue expert(s) for processing')
  .option('--environment <production|development>', 'specify cdl environment', 'production')
  .option('--invalidate','remove expert(s) from the cache')
  .option('--list', 'list cache information')
  .option('--max <n|empty|never>','when resolving, iterate over n experts, or rule', 'empty')
  .option('--output <output>', 'cache directory')
  .option('--priority <1-20>','priority for enqueue', 10)
  .option('--queue', 'list queue information')
  .option('--process','process expert(s) from the cache')
  .option_fuseki()
  .option_cdl()

program.parse(process.argv);

let opt = program.opts();
logger.info({ opt }, 'options');
await main(opt);
logger.info({mark: performance.mark('end')}, 'elapsed time');
