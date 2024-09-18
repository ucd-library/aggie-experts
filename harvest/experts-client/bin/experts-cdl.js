'use strict';
import { DataFactory } from 'rdf-data-factory';
import { BindingsFactory } from '@comunica/bindings-factory';
import ExpertsClient from '../lib/experts-client.js';
import QueryLibrary from '../lib/query-library.js';
import FusekiClient from '../lib/fuseki-client.js';
import { performance } from 'node:perf_hooks';
import { Command } from '../lib/experts-commander.js';
import { Cache, CacheExpert } from '../lib/cache/index.js';
import fs from 'fs-extra';

const DF = new DataFactory();
const BF = new BindingsFactory();
const ql = await new QueryLibrary().load();

// This also reads data from .env file via dotenv
const fuseki = new FusekiClient({
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
  type: 'tdb2',
  replace: true,
});

const cdl = {
  url: '',
  auth: '',
  secretpath: '',
};

async function main(opt, cache) {
  // get the secret JSON
  let secretResp = await program.gs.getSecret(opt.cdl.secretpath);
  let secretJson = JSON.parse(secretResp);
  for (const entry of secretJson) {
    if (entry['@id'] == opt.cdl.authname) {
      opt.cdl.auth = entry.auth.raw_auth;
    }
  }

  const ec = new ExpertsClient(opt);

  const users = program.args;

  if (opt.fetch) {
    // Step 1: Get Usernames from CDL using any cmd line args if no users specified
    if (users.length === 0 && opt.cdl.groups) {
      var uquery = `users?detail=ref&per-page=1000&groups=${opt.cdl.groups}`;
      var sinceFilter = '';

      if (opt.cdl.affected !== undefined && opt.cdl.affected !== null) {
        // We need the date in XML ISO format
        var date = new Date();
        date.setDate(date.getDate() - opt.cdl.affected); // Subtracts days
        sinceFilter = '&affected-since=' + date.toISOString();
        uquery += sinceFilter;
      }
      else if (opt.cdl.modified !== undefined && opt.cdl.modified !== null) {
        // We need the date in XML ISO format
        var date = new Date(opt.cdl.modified);
        sinceFilter = '&modified-since=' + date.toISOString();
        uquery += sinceFilter;
      }

      // Get the users from CDL that meet the criteria
      const entries = await ec.getCDLentries(uquery, 'users_via_groups');

      // Add them to the users array
      for (let entry of entries) {
        entry = entry['api:object'];
        users.push(entry['username'].substring(0, entry['username'].indexOf('@')));
      }

      log.info(users.length + ' users found');
    }
  }
  let normalized = cache.normalize_experts(users);

  //console.log(`Normalized ${normalized.length} users`, normalized);

  for (const user of normalized) {
    // Get username from mailto

    let expert = new CacheExpert(cache, user, opt);
    await expert.fetch();
    //console.log(`Fetched ${expert.expert}`);
    await expert.load();
    //console.log(`Loaded ${expert.expert}`);
    await expert.transform();
    //console.log(`Transformed ${expert.expert}`);

    let db = expert._db;
    // Any other value don't delete
    if (fuseki.delete === true) {
      const dropped = await fuseki.dropDb(db.db);
    }
    // log.info({measure:[user],user},`completed`);
    // performance.clearMarks(user);
  }
}

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exit } from 'process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename).replace('/bin', '/lib');

// Read custom config for expert dataset with hdt assembler setup
const assembler = fs.readFileSync(__dirname + '/fuseki-client/expert.jsonld', 'utf8');

const program = new Command();

performance.mark('start');
program.name('cdl-profile')
  .usage('[options] <users...>')
  .description('Import CDL Researcher Profiles and Works')
  .option('--output <output>', 'output directory','.')
  .option('--cdl.url <url>', 'Specify CDL endpoint', cdl.url)
  .option('--cdl.groups <groups>', 'Specify CDL group ids', cdl.groups)
  .option('--cdl.affected <affected>', 'affected since')
  .option('--cdl.modified <modified>', 'modified since (YYYY-MM-DD)')
  .option('--cdl.auth <user:password>', 'Specify CDL authorization', cdl.auth)
  .option('--cdl.timeout <timeout>', 'Specify CDL API timeout in milliseconds', 30000)
  .option('--author-truncate-to <max>', 'Truncate authors to max', 40)
  .option('--author-trim-info', 'Remove extraneous author info', true)
  .option('--no-author-trim-info')
  .option('--experts-service <experts-service>', 'Experts Sparql Endpoint', 'http://localhost:3030/experts/sparql')
  .option('--fuseki.type <type>', 'specify type on dataset creation', fuseki.type)
  .option('--fuseki.url <url>', 'fuseki url', fuseki.url)
  .option('--fuseki.auth <auth>', 'fuseki authorization', fuseki.auth)
  .option('--fuseki.delete', 'Delete the fuseki.db after running', fuseki.delete)
  .option('--no-fuseki.delete')
  .option('--fuseki.replace', 'Replace the fuseki.db (delete before import)', true)
  .option('--no-fuseki.replace')
  .option('--environment <env>', 'specify environment', 'production')
  .option('--no-fetch', 'fetch the data', true)
  .option('--skip-existing-user', 'skip if expert exists', false)
  .option_fuseki()
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

// fusekize opt
Object.keys(opt).forEach((k) => {
  const n = k.replace(/^fuseki./, '')
  if (n !== k) {
    fuseki[n] = opt[k];
    delete opt[k];
  }
});
//opt.db = fuseki;

// make cdl_info as object
Object.keys(opt).forEach((k) => {
  const n = k.replace(/^cdl\./, '')
  if (n !== k) {
    opt.cdl ||= {};
    opt.cdl[n] = opt[k];
    delete opt[k];
  }
});

if (opt.environment === 'development') {
  opt.cdl.url = 'https://qa-oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5';
  opt.cdl.authname = 'qa-oapolicy';
  opt.cdl.secretpath = 'projects/325574696734/secrets/cdl-elements-json';
  opt.cdl.secretpath = 'projects/325574696734/secrets/cdl-elements-json';
}
else if (opt.environment === 'production') {
  opt.cdl.url = 'https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5';
  opt.cdl.authname = 'oapolicy';
  opt.cdl.secretpath = 'projects/325574696734/secrets/cdl-elements-json';
}

opt.assembler = assembler;
log.info({ opt }, 'options');
await main(opt, cache);
