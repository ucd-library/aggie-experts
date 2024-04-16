'use strict';
import * as dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs-extra';
import { Command } from 'commander';
import { nanoid } from 'nanoid';

import { DataFactory } from 'rdf-data-factory';
import { BindingsFactory } from '@comunica/bindings-factory';

import ExpertsClient from '../lib/experts-client.js';
import QueryLibrary from '../lib/query-library.js';
import FusekiClient from '../lib/fuseki-client.js';
import { GoogleSecret } from '@ucd-lib/experts-api';
import { logger } from '../lib/logger.js';
import { performance } from 'node:perf_hooks';

import md5 from 'md5';

const DF = new DataFactory();
const BF = new BindingsFactory();

const ql = await new QueryLibrary().load();
const gs = new GoogleSecret();

const program = new Command();

// This also reads data from .env file via dotenv
const fuseki = new FusekiClient({
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
  type: 'tdb2',
  db: 'CAS',
  replace: true,
  'delete': true
});

const cdl = {
  url: '',
  auth: '',
  secretpath: '',
};

async function main(opt) {
  // get the secret JSON
  let secretResp = await gs.getSecret(opt.cdl.secretpath);
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

      logger.info(users.length + ' users found');
    }
  }

  let db
  // If fuseki.db is const, then create it
  if (fuseki.db !== 'CAS' && fuseki.db !== 'CAS-XX') {
    db = await fuseki.createDb(fuseki.db);
  }
  // Step 2: Get User Profiles and relationships from CDL
  for (const user of users) {
    let dbname
    let md=md5(`${user}@ucdavis.edu`);

    if (opt.skipExistingUser && fs.existsSync(`${opt.output}/expert/${md}.jsonld.json`)) {
      logger.info({mark:user},'skipping ' + user);
      continue;
    }
    logger.info({mark:user},'user ' + user);
    if (fuseki.db==='CAS-XX' || fuseki.db==='CAS') {
      dbname = user+(fuseki.db==='CAS-XX'?'-'+nanoid(2):'');
      let exists = await fuseki.existsDb(dbname);
      db = await fuseki.createDb(dbname);
      logger.info({measure:[user],user},`fuseki.createDb(${dbname})`);
    }

    // const profile = await ec.getCDLprofile(user, opt);

    if (opt.fetch) {
      try {
        await ec.getPostUser(db,user)
        logger.info({measure:[user],user},`getPostUser`);

        // Step 3: Get User Relationships from CDL
        // fetch all relations for user post to Fuseki. Note that the may be grants, etc.
        await ec.getPostUserRelationships(db,user,'detail=full');
        logger.info({measure:[user],user},`getPostUserRelationships`);

      }
      catch (e) {
        logger.error({ user, error: e }, `error ${user}`);
      }
    }

    if (opt.splay) {
      logger.info({mark:'splay',user},`splay`);
      const bindings = BF.fromRecord(
        { EXPERTS_SERVICE__: DF.namedNode(opt.expertsService) }
      );
      const iam = ql.getQuery('insert_iam', 'InsertQuery');
      await ec.insert({ ...iam, bindings, db });
      logger.info({measure:['splay'],user},`insert`);

      for (const n of ['expert', 'authorship', 'grant_role']) {
        logger.info({mark:n,user},`splay ${n}`);
        await (async (n) => {
          const splay = ql.getSplay(n);
          // While we test, remove frame
          delete splay['frame'];
          return await ec.splay({ ...splay, bindings, db, output: opt.output, user });
        })(n);
        logger.info({measure:[n],user},`splayed ${n}`);
        performance.clearMarks(n);
      };
      logger.info({measure:['splay',user],user},`splayed`);
      performance.clearMarks('splay');
    }
    // Any other value don't delete
    if (fuseki.delete === true) {
      const dropped = await fuseki.dropDb(db);
    }
    logger.info({measure:[user],user},`completed`);
    performance.clearMarks(user);
  }
}

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename).replace('/bin', '/lib');

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
  .option('--author-truncate-to <max>', 'Truncate authors to max', null)
  .option('--author-trim-info', 'Remove extraneous author info', true)
  .option('--no-author-trim-info')
  .option('--experts-service <experts-service>', 'Experts Sparql Endpoint', 'http://localhost:3030/experts/sparql')
  .option('--fuseki.type <type>', 'specify type on dataset creation', fuseki.type)
  .option('--fuseki.url <url>', 'fuseki url', fuseki.url)
  .option('--fuseki.auth <auth>', 'fuseki authorization', fuseki.auth)
  .option('--fuseki.db <name>', 'specify db. There are two special names; CAS which uses a new database w/ the users CAS identifier and CAS-XXXX which uses a database with the users CAS plus a random id.', fuseki.db)
  .option('--fuseki.delete', 'Delete the fuseki.db after running', fuseki["delete"])
  .option('--no-fuseki.delete')
  .option('--fuseki.replace', 'Replace the fuseki.db (delete before import)', true)
  .option('--no-fuseki.replace')
  .option('--environment <env>', 'specify environment', 'production')
  .option('--no-splay', 'splay data', true)
  .option('--no-fetch', 'fetch the data', true)
  .option('--skip-existing-user', 'skip if expert/md5(${user}@ucdavis.edu`) exists', false)
  .option('--debug-save-xml', 'Save fetched XML, use it instead of fetching if exists', false)


program.parse(process.argv);

let opt = program.opts();

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
logger.info({ opt }, 'options');
await main(opt);
