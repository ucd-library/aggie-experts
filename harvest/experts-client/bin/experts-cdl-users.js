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
import FusekiClient from '../lib/fuseki-client.js';
import { GoogleSecret } from '@ucd-lib/experts-api';

// const DF = new DataFactory();
// const BF = new BindingsFactory();

const gs = new GoogleSecret();

console.log('starting experts-cdl-fetch');

const program = new Command();

// This also reads data from .env file via dotenv
const fuseki = new FusekiClient({
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
  type: 'tdb2',
  replace: false,
  'delete': false,
  db: 'aggie'
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


  const context = {
    "@context": {
      "@base": "http://experts.ucdavis.edu/",
      "@vocab": "http://vivoweb.org/ontology/core#",
      "expert": "http://experts.ucdavis.edu/expert/",
      "schema": "http://schema.org/",
      "ucdlib": "http://schema.library.ucdavis.edu/schema#",
      "identifier": { "@id": "schema:identifier" },
      "proprietary_id": { "@id": "ucdlib:proprietary_id" },
    }
  };

  const users = program.args;

  if (fuseki.db) {
    opt.db=await fuseki.createDb(fuseki.db);
  }

  var uquery = 'users?detail=ref&per-page=1000';
  if (opt.username) {
    uquery += '&username=' + opt.username;
  }
  else if (users.length > 0) {
    uquery += '&ids=' + users;
  }
  else if (opt.cdl.groups) {
    uquery += '&groups=' + opt.cdl.groups;
  }

  if (opt.cdl.affected) {
    // We need the date in XML ISO format
    var date = new Date();
    date.setDate(date.getDate() - opt.cdl.affected); // Subtracts days
    uquery += '&affected-since=' + date.toISOString();
  }
  else if (opt.cdl.modified) {
    // We need the date in XML ISO format
    var date = new Date();
    date.setDate(date.getDate() - opt.cdl.modified); // Subtracts days
    uquery += '&modified-since=' + date.toISOString();
  }
  console.log('uquery', uquery);
  //return;


  // const entries = await ec.getCDLusers(opt, uquery, '.[]["api:object"]|{id,"proprietary-id",username}');
  const entries = await ec.getCDLentries(uquery,'users_via_groups');

  var expertArray = [];

  // if just a user list is requested, output and exit
  if (opt.userList) {
    for (let entry of entries) {
      entry = entry['api:object'];
      expertArray.push(entry['username'].substring(0, entry['username'].indexOf('@')));
    }
    console.log(expertArray.join(' '));
    return;
  }

  // MD5 hash of the user's email address and UCPath ID
  for (let entry of entries) {
    entry = entry['api:object'];
    let expert = {};
    expert['@id'] = 'expert:' + md5(entry['username']);
    expert['proprietary_id'] = entry['proprietary-id'];
    expert['identifiers'] = ["ark:/87287/d7mh2m/user/" + entry['id'],
    "ark:/87287/d7c08j/" + md5(entry['proprietary-id']),
    "mailto:" + entry['username']];
    expertArray.push(expert);
  }


  console.log('starting createJsonLd');
  let contextObj = context;

  contextObj["@id"] = 'http://oapolicy.universityofcalifornia.edu/';
  contextObj["@graph"] = expertArray;

  let jsonld = JSON.stringify(contextObj);
  console.log('starting createGraph');

  if (opt.db) {
    await opt.db.createGraphFromJsonLdFile(jsonld);
  }

  if (opt.output === '-') {
    // write to std out
    console.log(jsonld);
  }
  else if (opt.output) {
    fs.writeFileSync(opt.output, jsonld);
  }

  console.log(`Graph created successfully in dataset '${fuseki.db}'.`);

}

// Trick for getting __dirname in ES6 modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exit } from 'process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename).replace('/bin', '/lib');


program.name('cdl-profile')
  .usage('[options] <users...>')
  .description('Import CDL users list into Fuseki')
  .option('--output <output>', 'output directory')
  .option('--username <username>', 'Specify CDL username')
  .option('--cdl.url <url>', 'Specify CDL endpoint', cdl.url)
  .option('--cdl.auth <user:password>', 'Specify CDL authorization', cdl.auth)
  .option('--cdl.groups <groups>', 'Specify CDL group ids', cdl.groups)
  .option('--cdl.affected <affected>', 'affected since')
  .option('--cdl.modified <modified>', 'modified since')
  .option('--fuseki.type <type>', 'specify type on dataset creation', fuseki.type)
  .option('--fuseki.url <url>', 'fuseki url', fuseki.url)
  .option('--fuseki.auth <auth>', 'fuseki authorization', fuseki.auth)
  .option('--fuseki.db <name>', 'specify fuseki db', fuseki.db)
  .option('--environment <env>', 'specify environment', 'production')
  .option('--userList', 'output list of usernames', false)


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

// console.log('opt', opt);
await main(opt);
