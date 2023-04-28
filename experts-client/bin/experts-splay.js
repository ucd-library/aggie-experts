'use strict';
import fs from 'fs-extra';
import { Command} from 'commander';
import { Engine } from 'quadstore-comunica';
import { QueryEngine } from '@comunica/query-sparql';
import { localDB } from '../lib/experts-client.js';
import { DataFactory } from 'rdf-data-factory';

import ExpertsClient from '../lib/experts-client.js';
import JsonLdProcessor from 'jsonld';

const jsonld=new JsonLdProcessor();

 // This could go to our cmdline library, or we subclass
function str_or_file(opt,param,required) {
  if (opt[param]) {
    return opt[param];
  } else if (opt[param+'@']) {
    opt[param]=fs.readFileSync(opt[param+'@'],'utf8');
    return opt[param];
  } else if (required) {
    console.error('missing required option: '+param+'(@)');
    process.exit(1);
  } else {
    return null;
  }
}

const program = new Command();

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

program.parse(process.argv);

if (program.args.length > 0) {
  console.error('local files are not supported yet');
  process.exit(1);
}

const cli = program.opts();

const ec = new ExpertsClient(cli);

ec.splay(cli);

