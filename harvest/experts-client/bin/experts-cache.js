'use strict';
import path from 'path';
import fs from 'fs-extra';
import { Command } from '../lib/experts-commander.js';

import { BindingsFactory } from '@comunica/bindings-factory';

import IamClient  from '../lib/iam-client.js';
import ExpertsClient from '../lib/experts-client.js';
import QueryLibrary from '../lib/query-library.js';
import FusekiClient from '../lib/fuseki-client.js';
import { GoogleSecret } from '@ucd-lib/experts-api';
import { logger } from '../lib/logger.js';
import { performance } from 'node:perf_hooks';

const gs = new GoogleSecret();

const program = new Command();

// This also reads data from .env file via dotenv
const fuseki = new FusekiClient({
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
  type: 'tdb2',
  db: 'CAS',
  replace: true,
  'delete': false
});

async function temp_get_qa_grants(ec, db, user) {
  logger.info({ mark: 'grants' }, 'temp_get_qa_grants ' + user);
  const grant_id_types = "2,12,43,44,94,95,96,97,116,117,118,119,120,121,122,123,124,125,126,133,134,135,136,137,138,139,140,141"
  const orig_opt = ec.opt;
  const opt = {
    ...orig_opt,
    debugRelationshipDir: 'grants',
    cdl: {
      url: 'https://qa-oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
      authname: 'qa-oapolicy',
      secretpath: 'projects/325574696734/secrets/cdl-elements-json'
    }
  }
  let secretResp = await gs.getSecret(opt.cdl.secretpath);
  let secretJson = JSON.parse(secretResp);
  for (const entry of secretJson) {
    if (entry['@id'] == opt.cdl.authname) {
      opt.cdl.auth = entry.auth.raw_auth;
    }
  }

  const qa = new ExpertsClient(opt);
  qa.userId = ec.userId
  await qa.getPostUserRelationships(db, user, `detail=full&types=${grant_id_types}`);
  logger.info({ measure: 'grants' }, 'temp_get_qa_grants ' + user);

}


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

  // Step 2: Get User Profiles and relationships from CDL
  for (const user of users) {
    let dbname
    logger.info({mark:user},'user ' + user);

    if (opt.fetch) {
      try {
        await ec.getPostUser(db,user)
        logger.info({measure:[user],user},`getPostUser`);

        // Step 3: Get User Relationships from CDL
        // fetch all relations for user post to Fuseki. Note that the may be grants, etc.
        await ec.getPostUserRelationships(db,user,'detail=full');
        logger.info({measure:[user],user},`getPostUserRelationships`);

        // Step 3a: Get User Grants from CDL (qa-oapolicy only)
        await temp_get_qa_grants(ec,db,user);
        logger.info({measure:[user],user},`temp_get_qa_grant`);
      }
      catch (e) {
        logger.error({ user, error: e }, `error ${user}`);
      }
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
  .option('--default-domain','default university domain','ucdavis.edu')
  .option('--deprioritize','allow an enqueue request to reduce an experts priority',false)
  .option('--dequeue','remove expert(s) from the queue')
  .option('--enqueue', 'enqueue expert(s) for processing')
  .option('--environment <production|development>', 'specify cdl environment', 'production')
  .option('--fuseki.auth <auth>', 'fuseki authorization', fuseki.auth)
  .option('--fuseki.url <url>', 'fuseki url', fuseki.url)
  .option('--invalidate','remove expert(s) from the cache')
  .option('--list', 'list cache information')
  .option('--max <n|empty|never>','when resolving, iterate over n experts, or rule', 'empty')
  .option('--output <output>', 'cache directory')
  .option('--priority <1-20>','priority for enqueue', 10)
  .option('--queue', 'list queue information')
  .option('--resolve','resolve expert(s) from the cache')

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

logger.info({ opt }, 'options');
await main(opt);
