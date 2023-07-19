'use strict';
import * as dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs-extra';
import { Command } from 'commander';
import ExpertsClient from '../lib/experts-client.js';
import GoogleSecret from '../lib/googleSecret.js';

const gs = new GoogleSecret();

console.log('starting experts-iam');
const program = new Command();

const fuseki = {
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  type: 'mem',
  db: 'experts-rk',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
}

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
      opt.iam.auth = entry.auth.raw_auth.split(':')[1];
    }
  }

  const ec = new ExpertsClient(opt);

  opt.users = program.args;

  if (opt.users.length === 0) {
    if (opt.staff) {
      await ec.getIAMProfiles(opt, 'staff');
    }
    if (opt.faculty) {
      await ec.getIAMProfiles(opt, 'faculty');
    }
  }
  else {
    await ec.getIAMProfiles(opt, 'users');
  }

  console.log('starting createJsonLd');
  let contextObj = context;
  contextObj["@id"] = 'http://iam.ucdavis.edu/';
  contextObj["@graph"] = ec.doc;

  ec.jsonld = JSON.stringify(contextObj);
  // const outputFile = path.join(__dirname, '..', 'data', 'iam-profiles.jsonld');
  // await fs.writeFile(outputFile, ec.jsonld, 'utf8');

  console.log('starting createDataset');
  await ec.createDataset(opt);
  console.log(`Dataset '${opt.fuseki.db}' created successfully.`);

  //  This part should use are (now standard) insert_iam query.

  console.log('starting createGraph');
  await ec.createGraphFromJsonLdFile(ec.jsonld, opt);
  console.log(`Graph created successfully in dataset '${opt.fuseki.db}'.`);

  // Any other value don't delete
  if (opt.fuseki.isTmp === true && !opt.saveTmp) {
    const dropped = await ec.dropFusekiDb(opt);
  }
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

  .option('--source <source...>', 'Specify linked data source. Can be specified multiple times')
  .option('--fuseki.isTmp', 'create a temporary store, and files to it, and unshift to sources before splay.  Any option means do not remove on completion', false)
  .option('--fuseki.type <type>', 'specify type on --fuseki.isTmp creation', 'tdb')
  // Fuseki type, defaults to tdb for sure for IAM.
  .option('--fuseki.url <url>', 'fuseki url', fuseki.url)
  .option('--fuseki.auth <auth>', 'fuseki authorization', fuseki.auth)
  .option('--fuseki.db <name>', 'specify db on --fuseki.isTmp creation.  If not specified, a random db is generated', fuseki.db)
  .option('--save-tmp', 'Do not remove temporary file', false)


program.parse(process.argv);

let opt = program.opts();

// fusekize opt
Object.keys(opt).forEach((k) => {
  const n = k.replace(/^fuseki./, '')
  if (n !== k) {
    opt.fuseki ||= {};
    opt.fuseki[n] = opt[k];
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

// console.log(process.env);

opt.source = [opt.fuseki.url + '/' + opt.fuseki.db];

console.log('opt', opt);

if (opt.environment === 'development') {
  opt.iam.url = 'https://iet-ws-stage.ucdavis.edu/api/iam/';
  opt.iam.authname = 'iet-ws-stage';
  opt.iam.secretpath = 'projects/326679616213/secrets/ucdid_auth';
}
else if (opt.environment === 'production') {
  opt.iam.url = 'https://iet-ws.ucdavis.edu/api/iam/';
  opt.iam.authname = 'iet-ws';
  opt.iam.secretpath = 'projects/326679616213/secrets/ucdid_auth';
}


await main(opt);
