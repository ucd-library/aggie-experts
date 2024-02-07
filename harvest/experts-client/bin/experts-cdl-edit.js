'use strict';
import { Command } from '../lib/experts-commander.js';

import ExpertsClient from '../lib/experts-client.js';
import FusekiClient from '../lib/fuseki-client.js';
import { GoogleSecret } from '@ucd-lib/experts-api';

const gs = new GoogleSecret();

const program = new Command();

// This also reads data from .env file via dotenv
const fuseki = new FusekiClient({
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
  type: 'tdb',
  replace: false,
  'delete': false,
  db: 'experts'
});

async function main(opt) {

  // get the secret JSON
  let secretResp = await gs.getSecret(opt.cdl.secretpath);
  let secretJson = JSON.parse(secretResp);
  for (const entry of secretJson) {
    if (entry['@id'] == opt.cdl.authname) {
      opt.cdl.auth = entry.auth.raw_auth;
    }
  }

  const relationship_ids = program.args;

}

program.name('cdl-edit')
  .usage('[options] <relationship_ids>')
  .description('Update CDL user relationships')
  .option_cdl()
  .option('--username <username>', 'Specify CDL username (eduroam identifier)', '')
  .option('--visible', 'Alter work|grant visibility', false)
  .option('--no-visible', '', true)
  .option('--experts-service <experts-service>', 'Experts Sparql Endpoint', 'http://localhost:3030/experts/sparql')

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

console.log('opt', opt);
//await main(opt);
