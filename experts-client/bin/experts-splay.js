'use strict';
import fs from 'fs-extra';
import { Command} from 'commander';
import { Engine } from 'quadstore-comunica';
import { QueryEngine } from '@comunica/query-sparql';
import { localDB } from '../lib/experts-client.js';
import { DataFactory } from 'rdf-data-factory';

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
console.log(cli);
const bind = str_or_file(cli,'bind',true);
const construct = str_or_file(cli,'construct',true);
const frame = str_or_file(cli,'frame',false)
if (cli.frame) {
  cli.frame=JSON.parse(cli.frame);
}

let q;
let sources=null;
if (cli.quadstore) {
  const db = await localDB.create({level:'ClassicLevel',path:cli.quadstore});
//  cli.source=[db];
  q = new Engine(db.store);
  sources=null;
} else {
  q = new QueryEngine();
  sources=cli.source;
}

const factory=new DataFactory();

const bindingStream=await q.queryBindings(cli.bind,{sources: cli.source})
//const bindingStream=await q.queryBindings(cli.bind)
bindingStream
  .on('data', async (bindings) => {
    let fn=1; // write to stdout by default
    console.log(bindings.toString());
    if ( bindings.get('filename') && bindings.get('filename').value) {
      fn=bindings.get('filename').value
    }
    let graph = null;
    if (bindings.get('graph')) {
      graph=factory.namedNode(bindings.get('graph').value);
    }

    // convert construct to jsonld quads
    const quadStream = await q.queryQuads(cli.construct,{initialBindings:bindings, sources: cli.source});
    const quads = await quadStream.toArray();
    if (graph) {
      quads.forEach((quad) => {
        quad.graph=graph;
      });
    }
    console.log(`writing ${fn} with ${quads.length} quads`);
    let doc=await jsonld.fromRDF(quads)

    if (frame) {
      doc=await jsonld.frame(doc,cli.frame,{omitGraph:false,safe:true})
    } else {
      //      doc=await jsonld.expand(doc,{omitGraph:false,safe:true})
    }
    fs.writeFileSync(fn,JSON.stringify(doc,null,2));
  })
  .on('error', (error) => {
    console.error(error);
  })
  .on('end', () => {
    console.log('bindings done');
  });
