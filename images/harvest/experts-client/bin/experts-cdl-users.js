'use strict';
import * as dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs-extra';
import md5 from 'md5';
import { Command } from 'commander';
import { nanoid } from 'nanoid';

// import { DataFactory } from 'rdf-data-factory';
// import { BindingsFactory } from '@comunica/bindings-factory';

import ExpertsClient from '../lib/experts-client.js';
import QueryLibrary from '../lib/query-library.js';
import GoogleSecret from '../lib/googleSecret.js';

// const DF = new DataFactory();
// const BF = new BindingsFactory();

const ql = await new QueryLibrary().load();
const gs = new GoogleSecret();

console.log('starting experts-cdl-fetch');

const program = new Command();

// This also reads data from .env file via dotenv
const fuseki = {
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  type: 'mem',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
};

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


  const context = {
    "@context": {
      "@base": "http://experts.ucdavis.edu/",
      "@vocab": "http://vivoweb.org/ontology/core#",
      "person": "http://experts.ucdavis.edu/person/",
      "schema": "http://schema.org/",
      "identifier": { "@id": "schema:identifier" },
    }
  };

  const users = program.args;

  if (opt.fuseki.isTmp) {
    //console.log('starting createDataset');
    opt.fuseki.db = 'users-' + nanoid(5);
    const fuseki = await ec.mkFusekiTmpDb(opt);
    //console.log(`Dataset '${opt.fuseki.db}' created successfully.`);
    opt.source = [`${opt.fuseki.url}/${opt.fuseki.db}/sparql`];
  }

  console.log('starting CDL users fetch');

  var uquery = '';
  if (opt.username) {
    uquery = 'users?username=' + opt.username + '&detail=ref&per-page=1000';
  }
  else if (users.length > 0) {
    uquery = 'users?ids=' + users + '&detail=ref&per-page=1000';
  }
  else if (opt.cdl.groups) {
    uquery = 'users?groups=' + opt.cdl.groups + '&detail=ref&per-page=1000';
  }
  else {
    uquery = 'users?detail=ref&per-page=1000';
  }

  // const entries = await ec.getCDLusers(opt, uquery, '.[]["api:object"]|{id,"proprietary-id",username}');
  const entries = await ec.getCDLentries(opt, uquery);

  var personArray = [];

  // MD5 hash of the user's email address and UCPath ID
  for (let entry of entries) {
    entry = entry['api:object'];
    let person = {};
    person['@id'] = 'person:' + md5(entry['proprietary-id']);
    person['identifiers'] = ["ark:/87287/d7mh2m/user/" + entry['id'],
    "ark:/87287/d7c08j/" + md5(entry['username']),
    "mailto:" + entry['username']];
    personArray.push(person);
  }


  console.log('starting createJsonLd');
  let contextObj = context;

  contextObj["@id"] = 'http://oapolicy.universityofcalifornia.edu/';
  contextObj["@graph"] = personArray;

  let jsonld = JSON.stringify(contextObj);
  console.log('starting createGraph');

  await ec.createGraphFromJsonLdFile(jsonld, opt);

  fs.ensureDirSync('data');
  fs.writeFileSync(path.join('data', 'users.jsonld'), jsonld);
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


program.name('cdl-profile')
  .usage('[options] <users...>')
  .description('Import CDL users list into Fuseki')
  .option('--source <source...>', 'Specify linked data source. Used instead of --fuseki')
  .option('--output <output>', 'output directory', path.join(__dirname, '../data'))
  .option('--username <username>', 'Specify CDL username')
  .option('--cdl.url <url>', 'Specify CDL endpoint', cdl.url)
  .option('--cdl.auth <user:password>', 'Specify CDL authorization', cdl.auth)
  .option('--cdl.groups <groups>', 'Specify CDL group ids', cdl.groups)
  .option('--experts-service <experts-service>', 'Experts Sparql Endpoint', 'http://localhost:3030/experts/sparql')
  .option('--fuseki.isTmp', 'create a temporary store, and files to it, and unshift to sources before splay.  Any option means do not remove on completion', true)
  .option('--fuseki.type <type>', 'specify type on --fuseki.isTmp creation', 'tdb')
  .option('--fuseki.url <url>', 'fuseki url', fuseki.url)
  .option('--fuseki.auth <auth>', 'fuseki authorization', fuseki.auth)
  .option('--fuseki.db <name>', 'specify db on --fuseki.isTmp creation.  If not specified, a random db is generated', fuseki.db)
  .option('--save-tmp', 'Do not remove temporary file', false)
  .option('--environment <env>', 'specify environment', 'production')


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
  opt.cdl.secretpath = 'projects/326679616213/secrets/cdl_elements_json';
}
else if (opt.environment === 'production') {
  opt.cdl.url = 'https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v5.5';
  opt.cdl.authname = 'oapolicy';
  opt.cdl.secretpath = 'projects/326679616213/secrets/cdl_elements_json';
}

// console.log('opt', opt);
await main(opt);
