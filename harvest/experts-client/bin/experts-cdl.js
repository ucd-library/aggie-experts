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
import { GoogleSecret } from '@ucd-lib/experts-api';

const DF = new DataFactory();
const BF = new BindingsFactory();

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

  // Step 1: Get Usernames from CDL using any cmd line args
  var uquery = 'users?detail=ref&per-page=1000';
  var sinceFilter = '';

  if (opt.username) {
    uquery += '&username=' + opt.username;
  }
  else if (opt.cdl.groups) {
    uquery += '&groups=' + opt.cdl.groups;
  }

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
  console.log('uquery', uquery);
  // return;

  // Get the users from CDL that meet the criteria
  const entries = await ec.getCDLentries(opt, uquery);

  // Add them to the users array
  for (let entry of entries) {
    entry = entry['api:object'];
    users.push(entry['username'].substring(0, entry['username'].indexOf('@')));
  }


  console.log(users.join(' '));
  console.log(users.length + ' users found');
  // const usrs = users.slice(0, 5);
  // console.log(usrs.join(' '));
  // return;

  // Step 2: Get User Profiles and relationships from CDL
  for (const user of users) {

    if (opt.fuseki.isTmp) {
      // Create a random db name if not specified
      //console.log('starting createDataset');
      opt.fuseki.db = user + '-' + nanoid(5);
      const fuseki = await ec.mkFusekiTmpDb(opt);
      //console.log(`Dataset '${opt.fuseki.db}' created successfully.`);
      opt.source = [`${opt.fuseki.url}/${opt.fuseki.db}/sparql`];
    }

    console.log('starting getCDLprofile ' + user);

    // Get a full profile for the user
    const entries = await ec.getCDLentries(opt, 'users?username=' + user + '@ucdavis.edu&detail=full');
    // Assume a single entry for a user profile, but it's an array
    ec.profile = entries;

    let cdlId = entries[0]["api:object"].id;

    console.log('starting createJsonLd ' + user + '-' + cdlId);

    // Create the JSON-LD for the user profile
    let contextObj = context;

    contextObj["@id"] = 'http://oapolicy.universityofcalifornia.edu/';
    contextObj["@graph"] = ec.profile;

    let jsonld = JSON.stringify(contextObj);
    console.log('starting createGraph ' + user);

    // Insert into our local Fuseki
    await ec.createGraphFromJsonLdFile(jsonld, opt);

    console.log(`Graph created successfully in dataset '${opt.fuseki.db}'.`);
    console.log('starting getCDLentries ' + user + '-' + cdlId);

    // fetch all relations for user. Note that the may be grants, etc.
    ec.works = [];

    let works = await ec.getCDLentries(opt, 'users/' + cdlId + '/relationships?detail=full' + sinceFilter);


    for (let work of works) {
      let related = [];
      if (work['api:relationship'] && work['api:relationship']['api:related']) {
        related.push(work['api:relationship']['api:related']);
      }
      related.push({ direction: 'to', id: cdlId, category: 'user' });
      work['api:relationship'] ||= {};
      work['api:relationship']['api:related'] = related;
      ec.works.push(work['api:relationship']);
    }

    console.log(ec.works.length + ' works found for ' + user);

    console.log('starting createJsonLd ' + user);
    contextObj = context;
    contextObj["@id"] = 'http://oapolicy.universityofcalifornia.edu/';
    contextObj["@graph"] = ec.works;
    jsonld = JSON.stringify(contextObj);

    console.log('starting works createGraph ' + user);

    await ec.createGraphFromJsonLdFile(jsonld, opt);
    fs.writeFileSync(path.join(__dirname, '../data', user + '.jsonld'), jsonld);

    console.log(`Graph created successfully in dataset '${opt.fuseki.db}'.`);

    if (!opt.nosplay) {

      opt.bindings = BF.fromRecord(
        { EXPERTS_SERVICE__: DF.namedNode(opt.expertsService) }
      );
      const iam = ql.getQuery('insert_iam', 'InsertQuery');

      await ec.insert({ ...opt, ...iam });

      for (const n of ['person', 'work', 'authorship']) {
        await (async (n) => {
          const splay = ql.getSplay(n);
          // While we test, remove frame
          delete splay['frame'];
          return await ec.splay({ ...opt, ...splay });
        })(n);
      };
    }
    // Any other value don't delete
    if (opt.fuseki.isTmp === true && !opt.saveTmp) {
      const dropped = await ec.dropFusekiDb(opt);
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
  .option('--source <source...>', 'Specify linked data source. Used instead of --fuseki')
  .option('--output <output>', 'output directory')
  .option('--cdl.url <url>', 'Specify CDL endpoint', cdl.url)
  .option('--cdl.groups <groups>', 'Specify CDL group ids', cdl.groups)
  .option('--cdl.affected <affected>', 'affected since')
  .option('--cdl.modified <modified>', 'modified since')
  .option('--cdl.auth <user:password>', 'Specify CDL authorization', cdl.auth)
  .option('--experts-service <experts-service>', 'Experts Sparql Endpoint', 'http://localhost:3030/experts/sparql')
  .option('--fuseki.isTmp', 'create a temporary store, and files to it, and unshift to sources before splay.  Any option means do not remove on completion', true)
  .option('--fuseki.type <type>', 'specify type on --fuseki.isTmp creation', 'tdb')
  .option('--fuseki.url <url>', 'fuseki url', fuseki.url)
  .option('--fuseki.auth <auth>', 'fuseki authorization', fuseki.auth)
  .option('--fuseki.db <name>', 'specify db on --fuseki.isTmp creation.  If not specified, a random db is generated', fuseki.db)
  .option('--save-tmp', 'Do not remove temporary file', false)
  .option('--environment <env>', 'specify environment', 'production')
  .option('--nosplay', 'skip splay', false)


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
