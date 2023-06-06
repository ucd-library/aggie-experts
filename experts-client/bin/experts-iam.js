'use strict';
import * as dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs-extra';
import { Command } from 'commander';
import ExpertsClient from '../lib/experts-client.js';

console.log('starting experts-iam');
const program = new Command();

const fuseki = {
  url: process.env.EXPERTS_FUSEKI_URL || 'http://127.0.0.1:3030',
  type: 'mem',
  db: 'tmpDb',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:Evm08ltGmbP7ZAz',
}


async function main(opt) {

  //  console.log(opt);

  const ec = new ExpertsClient(opt);

  console.log('starting getIAMProfiles');

  await ec.getIAMProfiles(opt);

  console.log('starting createJsonLd');
  const iamContext = await fs.readFile(path.join(__dirname, '..', 'lib', 'context', 'iam-profile.json'));
  // const profilesLd = await ec.createJsonLd(ec.doc, JSON.parse(iamContext), 'http://iam.ucdavis.edu/');
  let contextObj = JSON.parse(iamContext);
  contextObj["@id"] = 'http://iam.ucdavis.edu/';
  contextObj["@graph"] = ec.doc;

  ec.jsonld = JSON.stringify(contextObj);
  const outputFile = path.join(__dirname, '..', 'data', 'iam-profiles.jsonld');
  await fs.writeFile(outputFile, ec.jsonld, 'utf8');

  console.log('starting createDataset');
  await ec.createDataset(opt);
  console.log(`Dataset '${opt.fuseki.db}' created successfully.`);

  console.log('starting createGraph');
  await ec.createGraphFromJsonLdFile(opt);
  console.log(`Graph created successfully in dataset '${opt.fuseki.db}'.`);

  console.log('starting splay');
  await ec.splay(opt);

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


program.name('iam')
  .usage('[options] <file...>')
  .description('Import IAM Researcher Profiles')
  .option('--iam-auth <key>', 'UC Davis IAM authentication key')
  .option('--userId <userId>', 'UC Davis IAM user id', 'cssmit')
  .option('--iam-endpoint <endpoint>', 'UC Davis IAM endpoint', 'https://iet-ws-stage.ucdavis.edu/api/iam/people/profile/search')
  .option('--bind <bind>', 'select query for binding')
  .option('--bind@ <bind.rq>', 'file containing select query for binding', __dirname + '/query/person/bind.rq')
  .option('--construct <construct>', 'construct query for each binding')
  .option('--construct@ <construct.rq>', 'file containing construct query for each binding', __dirname + '/query/person/construct.rq')
  .option('--frame <frame>', 'frame object for each binding')
  .option('--frame@ <frame.json>', 'file containing frame on the construct')
  .option('--source <source...>', 'Specify linked data source. Can be specified multiple times')
  .option('--quadstore <quadstore>', 'Specify a local quadstore.  Cannot be used with the --source option')
  .option('--fuseki.isTmp', 'create a temporary store, and files to it, and unshift to sources before splay.  Any option means do not remove on completion', true)
  .option('--fuseki.type <type>', 'specify type on --fuseki.isTmp creation', 'tdb')
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

// console.log(process.env);

opt.iamEndpoint = process.env.EXPERTS_IAM_ENDPOINT;
opt.iamAuth = process.env.EXPERTS_IAM_AUTH;
opt.source = [opt.fuseki.url + '/' + opt.fuseki.db];

console.log('opt', opt);

await main(opt);
