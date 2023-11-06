'use strict';
import winston from 'winston';
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

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `combined.log`
    //
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

const DF = new DataFactory();
const BF = new BindingsFactory();

const ql = await new QueryLibrary().load();
const gs = new GoogleSecret();

const program = new Command();

// This also reads data from .env file via dotenv
const fuseki = new FusekiClient({
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
  type: 'tdb',
  db: 'CAS',
  replace: true,
  'delete': false
});

const cdl = {
  url: '',
  auth: '',
  secretpath: '',
};

async function temp_get_qa_grants(orig_opt, user, cdlId, context, ec) {
  console.log('starting temp_get_qa_grants ' + user + '-' + cdlId);
  const grant_id_types = "2,12,43,44,94,95,96,97,116,117,118,119,120,121,122,123,124,125,126,133,134,135,136,137,138,139,140,141"
  const opt = {
    ...orig_opt,
    cdl: {
      url: 'https://qa-oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5',
      authname: 'qa-oapolicy',
      secretpath: 'projects/325574696734/secrets/cdl_elements_json'
    }
  }
  let secretResp = await gs.getSecret(opt.cdl.secretpath);
  let secretJson = JSON.parse(secretResp);
  for (const entry of secretJson) {
    if (entry['@id'] == opt.cdl.authname) {
      opt.cdl.auth = entry.auth.raw_auth;
    }
  }

  await ec.getPostCDLentries(opt, `users/${cdlId}/relationships?detail=full&types=${grant_id_types}`, cdlId, context, logger);
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

  // console.log('opt', opt);

  const ec = new ExpertsClient(opt);

  const context = {
    "@context": {
      "@base": "http://oapolicy.universityofcalifornia.edu/",
      "@vocab": "http://oapolicy.universityofcalifornia.edu/vocab#",
      "oap": "http://oapolicy.universityofcalifornia.edu/vocab#",
      "api": "http://oapolicy.universityofcalifornia.edu/vocab#",
      "id": { "@type": "@id", "@id": "@id" },
      "field-name": "api:field-name",
      "field-number": "api:field-number",
      "$t": "api:field-value",
      "api:person": { "@container": "@list" },
      "api:first-names-X": { "@container": "@list" },
      "api:web-address": { "@container": "@list" }
    }
  };

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
        var date = new Date();
        date.setDate(date.getDate() - opt.cdl.modified); // Subtracts days
        sinceFilter = '&modified-since=' + date.toISOString();
        uquery += sinceFilter;
      }

      // Get the users from CDL that meet the criteria
      const entries = await ec.getCDLentries(opt, uquery);

      // Add them to the users array
      for (let entry of entries) {
        entry = entry['api:object'];
        users.push(entry['username'].substring(0, entry['username'].indexOf('@')));
      }

      console.log(users.join(' '));
      console.log(users.length + ' users found');
    }
  }

  let db
  // If fuseki.db is const, then create it
  if (fuseki.db !== 'CAS' && fuseki.db !== 'CAS-XXXX') {
    db = await fuseki.createDb(fuseki.db);
  }
  // Step 2: Get User Profiles and relationships from CDL
  for (const user of users) {
    let dbname
    if (fuseki.db === 'CAS-XXXX' || fuseki.db === 'CAS') {
      dbname = user + (fuseki.db === 'CAS-XXXX' ? '-' + nanoid(2) : '');
      db = await fuseki.createDb(dbname);
      console.log(`Dataset '${dbname}' created successfully.`);
    }

    if (opt.fetch) {
      console.log('starting getCDLprofile ' + user);

      // Get a full profile for the user
      const entries = await ec.getCDLentries(opt, 'users?username=' + user + '@ucdavis.edu&detail=full');
      // Assume a single entry for a user profile, but it's an array
      ec.profile = entries;

      let cdlId = entries[0]["api:object"].id;

      console.log('starting createJsonLd ' + user + '-' + cdlId);

      // Create the JSON-LD for the user profile
      var relationshipsContext = JSON.stringify(context);
      let contextObj = context;

      contextObj["@id"] = 'http://oapolicy.universityofcalifornia.edu/';
      contextObj["@graph"] = ec.profile;

      let jsonld = JSON.stringify(contextObj);
      console.log('starting createGraph ' + user);

      // Insert into our local Fuseki
      await db.createGraphFromJsonLdFile(jsonld);

      console.log(`Graph created successfully in dataset '${dbname}'.`);
      console.log('starting getCDLentries ' + user + '-' + cdlId);

      // Step 3: Get User Relationships from CDL

      // fetch all relations for user post to Fuseki. Note that the may be grants, etc.
      opt.db = db
      await ec.getPostCDLentries(opt, 'users/' + cdlId + '/relationships?detail=full', cdlId, context);

      // Step 3a: Get User Grants from CDL (qa-oapolicy only)
      await temp_get_qa_grants(opt, user, cdlId, context, ec);
    }

    if (opt.splay) {
      const bindings = BF.fromRecord(
        { EXPERTS_SERVICE__: DF.namedNode(opt.expertsService) }
      );
      const iam = ql.getQuery('insert_iam', 'InsertQuery');

      await ec.insert({ ...iam, bindings, db });

      for (const n of ['expert', 'authorship', 'grant_role']) {
        await (async (n) => {
          const splay = ql.getSplay(n);
          // While we test, remove frame
          delete splay['frame'];
          return await ec.splay({ ...splay, bindings, db });
        })(n);
      };
    }
    // Any other value don't delete
    if (fuseki.delete === true) {
      const dropped = await fuseki.dropDb(db);
    }
  }
}

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename).replace('/bin', '/lib');


program.name('cdl-profile')
  .usage('[options] <users...>')
  .description('Import CDL Researcher Profiles and Works')
  .option('--output <output>', 'output directory')
  .option('--cdl.url <url>', 'Specify CDL endpoint', cdl.url)
  .option('--cdl.groups <groups>', 'Specify CDL group ids', cdl.groups)
  .option('--cdl.affected <affected>', 'affected since')
  .option('--cdl.modified <modified>', 'modified since')
  .option('--cdl.auth <user:password>', 'Specify CDL authorization', cdl.auth)
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
}
else if (opt.environment === 'production') {
  opt.cdl.url = 'https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5';
  opt.cdl.authname = 'oapolicy';
  opt.cdl.secretpath = 'projects/325574696734/secrets/cdl-elements-json';
}
//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (opt.environment !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// console.log('opt', opt);
await main(opt);
