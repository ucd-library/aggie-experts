'use strict';
import fs from 'fs-extra';
import { Command} from 'commander';
import { QueryEngine } from '@comunica/query-sparql';

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

const q = new QueryEngine();

const bindingStream=await q.queryBindings(cli.bind,{sources: cli.source})
bindingStream
  .on('data', async (bindings) => {
    if ( bindings.get('filename') && bindings.get('filename').value) {
      const fn=bindings.get('filename').value
      const quadStream = await q.queryQuads(cli.construct,{initialBindings:bindings, sources: cli.source});
      if (frame) {
        const quads = await quadStream.toArray();
        console.log(`writing ${fn} with ${quads.length} quads`);
        const doc=await jsonld.fromRDF(quads)
        const framed=await jsonld.frame(doc,cli.frame,{omitGraph:false,safe:true})
        if (bindings.get('uri')) {
          framed['@id']=bindings.get('uri').value;
        }
        fs.writeFileSync(fn,JSON.stringify(framed,null,2));
      } else {
        const c = await q.query(construct,{initialBindings:bindings,sources: cli.source});
        const {data} = await q.resultToString(c,'application/ld+json');
        await fs.ensureFile(fn)
        const writeStream = fs.createWriteStream(fn);
        data.pipe(writeStream);
        data.on('end', () => {
          console.log('done writing '+fn);
        });
      }
    } else {
      console.log('no filename');
    }
  })
  .on('error', (error) => {
    console.error(error);
  })
  .on('end', () => {
    console.log('bindings done');
  });
