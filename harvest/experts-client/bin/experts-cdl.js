'use strict';
import { performance } from 'node:perf_hooks';
import { Command } from '../lib/experts-commander.js';
import { Cache, CacheExpert } from '../lib/cache/index.js';
import fs from 'fs-extra';
import path from 'path';


async function main(opt, cache) {

  const users = program.args;

  if (users.length === 0 && opt.groups) {
    let group_users=await opt.cdl.getGroupList(opt.groups)
    users.push(...group_users)
  }
  let normalized = cache.normalize_experts(users);

  for (const expert of normalized) {
    let cache_expert = new CacheExpert(cache, expert, opt);
    if (opt.skipExisting) {
      const pd = cache_expert.verify_or_create_cache_directory();
      const fn = path.join(pd, 'fcrepo','expert');
      // if fn has files in it, then we assume it is a valid cache
      if (fs.existsSync(fn) && fs.readdirSync(fn).length > 0) {
        log.info({measure:expert,expert},`✔* ${fn}`);
        continue;
      }
    }
    await cache_expert.fetch();
    await cache_expert.load();
    await cache_expert.transform();
    if (opt.fuseki.delete === true && cache_expert._db) {
      log.info(`Deleting ${cache_expert._db.db}`);
      await cache_expert._db.drop();
    }
  }
}

const program = new Command();

performance.mark('start');
program.name('experts-cdl')
  .usage('[options] <experts...>')
  .description('Import CDL Researcher Profiles and Works')
  .option('--groups <groups>', 'Specify CDL group ids')
  .option('--cdl.affected <affected>', 'affected since')
  .option('--cdl.modified <modified>', 'modified since (YYYY-MM-DD)')
  .option('--author-truncate-to <max>', 'Truncate authors to max', 40)
  .option('--author-trim-info', 'Remove extraneous author info', true)
  .option('--no-author-trim-info')
  .option('--environment <env>', 'specify environment', 'production')
  .option('--skip-existing', 'skip if expert fcrepo file exists', false)
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
