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
  db: 'cdl-profiles',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:**nopass**',
}

const cdlToken = Buffer.from(process.env.EXPERTS_CDL_AUTH).toString('base64');


async function main(opt) {

  //  console.log(opt);

  const ec = new ExpertsClient(opt);
  const profileContext = await fs.readFile(path.join(__dirname, '..', 'lib', 'context', 'cdl-no-map-id.json'));
  const worksContext = await fs.readFile(path.join(__dirname, '..', 'lib', 'context', 'cdl-map-id.json'));

  console.log('starting createDataset');
  await ec.createDataset(opt)
  console.log(`Dataset '${opt.fuseki.db}' created successfully.`);

  console.log('starting getCDLProfiles');

  for (const user of opt.users) {
    console.log('starting getCDLprofile ' + user);

    const entries = await ec.getCDLentries(opt, 'users?username=' + user + '@ucdavis.edu&detail=full');
    // Assume a single entry for a user profile
    ec.doc = entries[0]['api:object'];

    console.log('starting createJsonLd ' + user);
    let contextObj = JSON.parse(profileContext);
    contextObj["@id"] = 'http://oapolicy.universityofcalifornia.edu/';
    contextObj["@graph"] = ec.doc;
    ec.jsonld = JSON.stringify(contextObj);
    console.log('starting createGraph ' + user);
    await ec.createGraphFromJsonLdFile(opt);
    fs.writeFileSync('data/' + user + '.jsonld', ec.jsonld);
    console.log(`Graph created successfully in dataset '${opt.fuseki.db}'.`);

    console.log(ec.doc.id);

    console.log('starting getCDLentries ' + user);

    // fetch publications for user
    ec.works = await ec.getCDLentries(opt, 'users/' + ec.doc.id + '/publications?detail=ref');

    console.log('starting createJsonLd ' + user);
    contextObj = JSON.parse(worksContext);
    contextObj["@id"] = 'http://oapolicy.universityofcalifornia.edu/';
    contextObj["@graph"] = ec.works;
    ec.jsonld = JSON.stringify(contextObj);
    // console.log(ec.jsonld);

    console.log('starting works createGraph ' + user);
    await ec.createGraphFromJsonLdFile(opt);
    fs.writeFileSync('data/' + user + '-works.jsonld', ec.jsonld);
    console.log(`Graph created successfully in dataset '${opt.fuseki.db}'.`);

  };

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


program.name('cdl-profile')
  .usage('[options] <file...>')
  .description('Import CDL Researcher Profiles')
  .option('--iam-auth <key>', 'UC Davis CDL authentication key')
  .option('--userId <userId>', 'UC Davis CDL user id')
  .option('--iam-endpoint <endpoint>', 'UC Davis IAM endpoint', 'https://iet-ws-stage.ucdavis.edu/api/iam/people/profile/search')
  .option('--cdl-endpoint <endpoint>', 'CDL Elements endpoint', 'https://qa-experts.ucdavis.edu')
  .option('--bind <bind>', 'select query for binding')
  .option('--bind@ <bind.rq>', 'file containing select query for binding', __dirname + '/query/person/bind-cdl.rq')
  .option('--construct <construct>', 'construct query for each binding')
  .option('--construct@ <construct.rq>', 'file containing construct query for each binding', __dirname + '/query/person/construct.rq')
  .option('--frame <frame>', 'frame object for each binding')
  .option('--frame@ <frame.json>', 'file containing frame on the construct')
  .option('--source <source...>', 'Specify linked data source. Can be specified multiple times')
  .option('--quadstore <quadstore>', 'Specify a local quadstore.  Cannot be used with the --source option')
  .option('--fuseki.isTmp', 'create a temporary store, and files to it, and unshift to sources before splay.  Any option means do not remove on completion', false)
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

opt.iamEndpoint = process.env.EXPERTS_IAM_ENDPOINT;
opt.iamAuth = process.env.EXPERTS_IAM_AUTH;
opt.source = [opt.fuseki.url + '/' + opt.fuseki.db];
opt.users = ['jrmerz'] //, 'jrmerz', 'quinn'];
opt.url = process.env.EXPERTS_CDL_ENDPOINT || 'https://qa-experts.ucdavis.edu';
opt.cdlAuth = cdlToken;

// console.log('opt', opt);

await main(opt);
