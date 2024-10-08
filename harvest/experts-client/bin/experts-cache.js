#! /usr/bin/env -S node --no-warnings
'use strict';
import { Command } from '../lib/experts-commander.js';
import Cache from '../lib/cache/index.js';

const program = new Command();

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
  .option('--priority <1-20>|all','priority for enqueue(all=10), queue, and dequeue', 'all')
  .option('--queue', 'list queue information')
  .option('--process','process expert(s) from the cache')
  .option_fuseki()
  .option_cdl()
  .option_log()
  .option_iam()
  .option_kcadmin()
  .parse(process.argv);

let opt = await program.opts();
const log = opt.log;
//log.info({mark:'experts-cache'}, 'experts-cache');

const cache= new Cache(opt);

let queue=null;
let list=null;
let experts = program.args;

// Allow multiple commands to be specified, order is
// dequeue, enqueue, queue, invalidate, process, list

if (opt.dequeue) {
  queue=await cache.dequeue(experts);
}
if (opt.enqueue) {
  queue=await cache.enqueue(experts);
}
if (opt.queue) {
  queue=await cache.queue(experts);
}
if (opt.invalidate) {
  queue=await cache.invalidate(experts);
}
if (opt.process) {
  queue=await cache.process(experts);
}
if (opt.list) {
  list=await cache.list(experts);
}

// Outputs
if (queue) {
  console.log(JSON.stringify(queue, null, 2));
  log.info({queue: queue}, 'queue');
}
if (list) {
  console.log(JSON.stringify(queue, null, 2));
  log.info({cache: cache}, 'cache');
}

//log.info({measure:'experts-cache'}, 'experts-cache');
