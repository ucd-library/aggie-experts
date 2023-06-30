'use strict';
import fs from 'fs-extra';
import { Command } from 'commander';
import { Engine } from 'quadstore-comunica';
import { QueryEngine } from '@comunica/query-sparql';
import { localDB } from '../lib/experts-client.js';
import { DataFactory } from 'rdf-data-factory';

import ExpertsClient from '../lib/experts-client.js';
import QueryLibrary from '../lib/query-library.js';

const fuseki = {
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3030',
  type: 'mem',
  db: null,
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
}

const cdl = {
  url: process.env.CDL_URL || 'http://oapolicy.universityofcalifornia.edu:8080',
  auth: process.env.CDL_AUTH || 'ucd:**nopass**',
}

const program = new Command();

program.name('cdl')
  .usage('[options] <file...>')
  .description('Using a select, and a construct, splay a graph, into individual files.  Any files includes are added to a (potentially new) localdb before the construct is run.')
  .option('--output <output>', 'output directory')
  .option('--source <source...>', 'Specify linked data source. Can be specified multiple times')
  .option('--fuseki.isTmp', 'create a temporary store, and files to it, and unshift to sources before splay.  Any option means do not remove on completion', false)
  .option('--fuseki.type [type]', 'specify type on --fuseki.isTmp creation', 'mem')
  .option('--fuseki.url', 'fuseki url', fuseki.url)
  .option('--fuseki.auth', 'fuseki authorization', fuseki.auth)
  .option('--fuseki.db <name>', 'specify db on --fuseki.isTmp creation.  If not specified, a random db is generated')
  .option('--save-tmp', 'Do not remove temporary file', false)

program.parse(process.argv);

const ql = await new QueryLibrary().load();

// This sbould be a standard function for all cmdline tools
const cli = program.opts();
// fusekize cli
Object.keys(cli).forEach((k) => {
  const n = k.replace(/^fuseki./, '')
  if (n !== k) {
    cli.fuseki ||= {};
    cli.fuseki[n] = cli[k];
    delete cli[k];
  }
});

const files = program.args;

const ec = new ExpertsClient(cli);
if (cli.fuseki.isTmp) {
  const fuseki = await ec.mkFusekiTmpDb(cli, files);
  console.log(cli);
  cli.source ||= [];
  cli.source.unshift(`${cli.fuseki.url}/${cli.fuseki.db}/sparql`);
}

for (const n of ['person', 'work', 'authorship']) {
  (async (n) => {
    const splay = ql.getSplay(n);
    console.log(splay)
    //    delete splay["frame@"];
    return await ec.splay({ ...cli, ...splay });
  })(n);
};

// Any other value don't delete
if (cli.fuseki.isTmp === true && !cli.saveTmp) {
  const dropped = await ec.dropFusekiDb(cli);
}