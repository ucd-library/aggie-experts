'use strict';
import fs from 'fs-extra';
import { Command } from 'commander';
import { Engine } from 'quadstore-comunica';
import { QueryEngine } from '@comunica/query-sparql';
import { DataFactory } from 'rdf-data-factory';

import ExpertsClient from '../lib/experts-client.js';
import QueryLibrary from '../lib/query-library.js';
import JsonLdProcessor from 'jsonld';

const jsonld = new JsonLdProcessor();
const program = new Command();

const fuseki = {
  url: process.env.EXPERTS_FUSEKI_URL || 'http://localhost:3033',
  type: 'mem',
  db: null,
  auth: process.env.EXPERTS_FUSEKI_AUTH || 'admin:testing123',
}

program.name('splay')
  .usage('[options] <file...>')
  .description('Using a select, and a construct, splay a graph, into individual files.  Any files includes are added to a (potentially new) localdb before the construct is run.')
  .option('--bind <bind>', 'select query for binding')
  .option('--bind@ <bind.rq>', 'file containing select query for binding')
  .option('--construct <construct>', 'construct query for each binding')
  .option('--construct@ <construct.rq>', 'file containing construct query for each binding')
  .option('--frame <frame>', 'frame object for each binding')
  .option('--frame@ <frame.json>', 'file containing frame on the construct')
  .option('--source <source...>', 'Specify linked data source. Can be specified multiple times')
  .option('--quadstore <quadstore>', 'Specify a local quadstore.  Cannot be used with the --source option')
  .option('--output <output>', 'output directory')
  .option('--splay <splay>', 'splay type')
  .option('--fuseki.isTmp', 'create a temporary store, and files to it, and unshift to sources before splay.  Any option means do not remove on completion', false)
  .option('--fuseki.type', 'specify type on --fuseki.isTmp creation', 'mem')
  .option('--fuseki.url', 'fuseki url', fuseki.url)
  .option('--fuseki.auth', 'fuseki authorization', fuseki.auth)
  .option('--fuseki.db=<name>', 'specify db on --fuseki.isTmp creation.  If not specified, a random db is generated')
  .option('--save-tmp', 'Do not remove temporary file', false)


program.parse(process.argv);

const ql = await new QueryLibrary().load();

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
  cli.source ||= [];
  cli.source.unshift(`${cli.fuseki.url}/${cli.fuseki.db}`);
}

let splay={}
if (cli.splay) {
  splay = ql.getSplay(cli.splay);
}

const splayed = await ec.splay({...splay,...cli})

// Any other value don't delete
if (splayed && cli.fuseki.isTmp === true && !cli.saveTmp) {
  const dropped = await ec.dropFusekiDb(cli);
}
