'use strict';
import { performance } from 'node:perf_hooks';
import { Command } from '../lib/experts-commander.js';
import { Cache, CacheExpert } from '../lib/cache/index.js';
import fs from 'fs-extra';


async function main(opt, cache) {

  const users = program.args;

  if (users.length === 0 && opt.groups) {
    let group_users=await opt.cdl.getGroupList(opt.cdl.groups)
    users.push(...group_users)
  }
  let normalized = cache.normalize_experts(users);

  for (const user of normalized) {
    let expert = new CacheExpert(cache, user, opt);
    await expert.fetch();
    await expert.load();
    await expert.transform();
    if (opt.fuseki.delete === true && expert._db) {
      console.log(`Deleting ${expert._db}`);
//        await expert._db.drop();
    }
  }
}

const program = new Command();

performance.mark('start');
program.name('experts-cdl')
  .usage('[options] <users...>')
  .description('Import CDL Researcher Profiles and Works')
  .option('--output <output>', 'output directory','.')
  .option('--groups <groups>', 'Specify CDL group ids')
  .option('--cdl.affected <affected>', 'affected since')
  .option('--cdl.modified <modified>', 'modified since (YYYY-MM-DD)')
  .option('--author-truncate-to <max>', 'Truncate authors to max', 40)
  .option('--author-trim-info', 'Remove extraneous author info', true)
  .option('--no-author-trim-info')
  .option('--environment <env>', 'specify environment', 'production')
  .option('--skip-existing-user', 'skip if expert exists', false)
  .option_fuseki()
  .option('--fuseki.delete', 'Delete the fuseki.db after running', true)
  .option('--no-fuseki.delete')
  .option_cdl()
  .option_log()
  .option_iam()
  .option_kcadmin()
  .parse(process.argv);

let opt = await program.opts();
const log = opt.log;

const cache= new Cache(opt);

let queue=null;
let list=null;

await main(opt, cache);
