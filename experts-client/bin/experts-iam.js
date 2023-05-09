'use strict';
import * as dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import ExpertsClient from '../lib/experts-client.js';

console.log('starting experts-iam');
const program = new Command();

async function main(cli) {

  const ec = new ExpertsClient(cli);

  const datasetName = ec.cli.fusekiDataset;
  // const graphName = 'http://iam.ucdavis.edu/';
  const fusekiUrl = ec.cli.fusekiEndpoint;
  const username = ec.cli.fusekiUser;
  const password = ec.cli.fusekiPW;

  const jsonLdFilePath = '/Users/rogerkunkel/projects/aggie-experts/experts-client/faculty.jsonld';

  console.log('starting getIAMProfiles');
  await ec.getIAMProfiles();
  console.log('starting processIAMProfiles');
  await ec.processIAMProfiles();
  console.log('starting createDataset');
  // await ec.createDataset('iam_profiles','tdb');
  await ec.createDataset(datasetName, fusekiUrl, username, password)
    .then(() => {
      console.log(`Dataset '${datasetName}' created successfully.`);
    })
    .catch((err) => {
      console.error(`Failed to create dataset: ${err}`);
    });

  console.log('starting createGraph');

  await ec.createGraphFromJsonLdFile(datasetName, jsonLdFilePath, fusekiUrl, username, password)
    .then(() => {
      console.log(`Graph created successfully in dataset '${datasetName}'.`);
    })
    .catch((err) => {
      console.error(`Failed to create graph: ${err}`);
    });

  console.log('starting splay');
  await ec.splay();

}


program.name('iam')
  .usage('[options] <file...>')
  .description('Import IAM Researcher Profiles')
  .option('--iam-auth <key>', 'UC Davis IAM authentication key')
  .option('--iam-endpoint <endpoint>', 'UC Davis IAM endpoint')
  .option('--bind <bind>', 'select query for binding')
  .option('--bind@ <bind.rq>', 'file containing select query for binding')
  .option('--construct <construct>', 'construct query for each binding')
  .option('--construct@ <construct.rq>', 'file containing construct query for each binding')
  .option('--frame <frame>', 'frame object for each binding')
  .option('--frame@ <frame.json>', 'file containing frame on the construct')
  .option('--source <source...>', 'Specify linked data source. Can be specified multiple times')
  .option('--quadstore <quadstore>', 'Specify a local quadstore.  Cannot be used with the --source option')


program.parse(process.argv);
const cli = program.opts();

await main(cli);
