'use strict';
import * as dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import ExpertsClient from '../lib/experts-client.js';

console.log('starting experts-iam');
const program = new Command();

const fuseki = {
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3033',
  type: 'mem',
  db: null,
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
}


async function main(opt) {

  const ec = new ExpertsClient(opt);

  console.log('starting getIAMProfiles');

  await ec.getIAMProfiles(opt);

  console.log('starting processIAMProfiles');
  await ec.processIAMProfiles(opt);

  console.log('starting createDataset');
  // await ec.createDataset(opt)
  await ec.mkFusekiTmpDb(opt, './faculty.jsonld');
  console.log(`Dataset '${opt.fuseki.db}' created successfully.`);

  console.log('starting createGraph');
  await ec.createGraphFromJsonLdFile(opt);
  console.log(`Graph created successfully in dataset '${opt.fuseki.db}'.`);

  console.log('starting splay');
  await ec.splay(opt);

}


program.name('iam')
  .usage('[options] <file...>')
  .description('Import IAM Researcher Profiles')
  .option('--iam-auth <key>', 'UC Davis IAM authentication key')
  .option('--iam-endpoint <endpoint>', 'UC Davis IAM endpoint')
  .option('--bind <bind>', 'select query for binding')
  .option('--bind@ <bind.rq>', 'file containing select query for binding')
  .option('--construct <construct>', 'construct query for each binding', '/Users/rogerkunkel/projects/aggie-experts/experts-client/queries/iam_person_to_vivo.rq')
  .option('--construct@ <construct.rq>', 'file containing construct query for each binding', '/Users/rogerkunkel/projects/aggie-experts/experts-client/queries/iam_person_to_vivo.rq')
  .option('--frame <frame>', 'frame object for each binding')
  .option('--frame@ <frame.json>', 'file containing frame on the construct')
  .option('--source <source...>', 'Specify linked data source. Can be specified multiple times')
  .option('--quadstore <quadstore>', 'Specify a local quadstore.  Cannot be used with the --source option')
  .option('--fuseki.isTmp', 'create a temporary store, and files to it, and unshift to sources before splay.  Any option means do not remove on completion', false)
  .option('--fuseki.type <type>', 'specify type on --fuseki.isTmp creation', 'tdb')
  .option('--fuseki.url <url>', 'fuseki url', fuseki.url)
  .option('--fuseki.auth <auth>', 'fuseki authorization', fuseki.auth)
  .option('--fuseki.db <name>', 'specify db on --fuseki.isTmp creation.  If not specified, a random db is generated', 'tmpDb')
  .option('--save-tmp', 'Do not remove temporary file', false)


program.parse(process.argv);
const opt = program.opts();
// fusekize opt
Object.keys(opt).forEach((k) => {
  const n = k.replace(/^fuseki./, '')
  if (n !== k) {
    opt.fuseki ||= {};
    opt.fuseki[n] = opt[k];
    delete opt[k];
  }
});

console.log('opt', opt);

await main(opt);
