'use strict';
import * as dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs-extra';
import { Command } from 'commander';
import ExpertsClient from '../lib/experts-client.js';
import FusekiClient from '../lib/fuseki-client.js';
import { GoogleSecret } from '@ucd-lib/experts-api';

const gs = new GoogleSecret();

console.log('starting experts-iam');
const program = new Command();

const fuseki = new FusekiClient({
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
  type: 'tdb',
  replace: false,
  'delete': false,
  db: 'experts'
});

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
    "api:web-address": { "@container": "@list" }
  }
};

const iam = {
  url: '',
  auth: '',
  secretpath: '',
};

async function main(opt) {

  //  console.log(opt);

  // get the secret JSON
  let secretResp = await gs.getSecret(opt.iam.secretpath);
  let secretJson = JSON.parse(secretResp);
  for (const entry of secretJson) {
    if (entry['@id'] == opt.iam.authname) {
      opt.iam.auth = entry.auth.raw_auth;
    }
  }

  const ec = new ExpertsClient(opt);

  opt.users = program.args;

  if (opt.users.length === 0) {
    if (opt.staff) {
      await ec.getIAMProfiles('isStaff=true');
    }
    if (opt.faculty) {
      await ec.getIAMProfiles('isFaculty=true');
    }
  }
  else {
    await ec.getIAMProfiles('userId=' + opt.users);
  }

  console.log('starting createJsonLd');
  let contextObj = context;
  contextObj["@id"] = 'http://iam.ucdavis.edu/';
  contextObj["@graph"] = ec.experts;

  ec.jsonld = JSON.stringify(contextObj);
  if (opt.output === '-') {
    // write to std out
    console.log(ec.jsonld);
  }
  else if (opt.output) {
    fs.writeFileSync(opt.output, ec.jsonld);
  }

  console.log('starting createFusekiDb');
  const db=await fuseki.createDb(fuseki.db);
  console.log(`Dataset '${fuseki.db}' created successfully.`);

  //  This part should use are (now standard) insert_iam query.

  console.log('starting createGraph');
  await db.createGraphFromJsonLdFile(ec.jsonld);
  console.log(`Graph created successfully in dataset '${fuseki.db}'.`);
}

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename).replace('/bin', '/lib');


program.name('experts-iam')
  .usage('[options] <experts...>')
  // If we have any casId's, on the cmdline, then we assumed --no-staff and --no-faculty and only process those casId's
  .description('Import IAM Researcher Profiles')
  .option('--environment <env>', 'specify environment', 'production')

  // IAM endpoint and auth are now in Google Secret Manager, and a function of the environment.
  .option('--iam.url <url>', 'Specify CDL endpoint', iam.url)
  .option('--iam.auth <user:password>', 'Specify CDL authorization', iam.auth)

  // Whether to download all staff
  .option('--no-staff', 'Do not include staff')
  // Whether to download all faculty
  .option('--no-faculty', 'Do not include faculty')
  .option('--output <output>', 'output directory')
  .option('--fuseki.type <type>', 'specify type on dataset creation', fuseki.type)
  .option('--fuseki.url <url>', 'fuseki url', fuseki.url)
  .option('--fuseki.auth <auth>', 'fuseki authorization', fuseki.auth)
  .option('--fuseki.db <name>', 'specify fuseki db', fuseki.db)

program.parse(process.argv);

let opt = program.opts();

// fusekize opt
Object.keys(opt).forEach((k) => {
  const n = k.replace(/^fuseki./, '')
  if (n !== k) {
    fuseki ||= {};
    fuseki[n] = opt[k];
    delete opt[k];
  }
});

// make iam_info as object
Object.keys(opt).forEach((k) => {
  const n = k.replace(/^iam\./, '')
  if (n !== k) {
    opt.iam ||= {};
    opt.iam[n] = opt[k];
    delete opt[k];
  }
});

if (opt.environment === 'development') {
  opt.iam.url = 'https://iet-ws-stage.ucdavis.edu/api/iam/';
  opt.iam.authname = 'iet-ws-stage';
  opt.iam.secretpath = 'projects/325574696734/secrets/ucdid_auth';
}
else if (opt.environment === 'production') {
  opt.iam.url = 'https://iet-ws.ucdavis.edu/api/iam/';
  opt.iam.authname = 'iet-ws';
  opt.iam.secretpath = 'projects/325574696734/secrets/ucdid_auth';
}

await main(opt);
