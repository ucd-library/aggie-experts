import fs from 'fs';
import { Command} from 'commander';
const program = new Command();

//import {ExpertsClient from '../experts-client.js';
import { localDB } from '../experts-client.js';

const db_config = {
  level: process.env.EXPERTS_LEVEL ?? 'ClassicLevel'
}

program.option('--source <source...>', 'source file(s) to load');

program.command('load <file...>')
  .description('Import jsonld files into the local database')
  .action(async (file,options) => {
    console.log('Program:',options);
    console.log('file: %s', file);
    const db = await localDB.create(db_config);
    await db.load(file);
  });

program.command('query [file...]')
  .option('-q, --query <query>', 'The query to execute')
  .option('-f, --query@ <rq>', 'File containing the query to execute')
  .description('Preform a query on the local database.  Import any supplied files before querying')
  .action(async (file,cli) => {
    console.log('cli:',cli);
    if( ! cli.query ) {
      if(cli['query@']) {
        cli.query=fs.readFileSync(cli['query@'],{encoding:'utf8',flag:'r'})
        console.log(cli.query)
      } else {
        console.error('No query Specified')
        process.exit(1);
      }
    }
    const db = await localDB.create(db_config);
    await db.load(file);
    const bindingsStream = await db.queryBindings(cli.query);
    bindingsStream.on('data', (binding) => {
      for( const [key,value] of binding ) {
        console.log(`${key.value} = ${value.value}`);
      }
    });
  });

program.command('splay [file...]')
  .option('--bind <bind>', 'select query for binding')
  .option('--bind@ <bind.rq>', 'file containing select query for binding')
  .option('--construct <construct>', 'construct query for each binding')
  .option('--construct@ <construct.rq>', 'file containing construct query for each binding')
  .description('Using a select, and a construct, splay a graph, into individual files.  Any files includes are added to the localdb before the construct is run.')
  .action(async (file,cli,command) => {
    console.log('cli:',cli);
    console.log('parent_cli:',command.parent.opts());
    if( ! cli.bind ) {
      if(cli['bind@']) {
        cli.bind=fs.readFileSync(cli['query@'],{encoding:'utf8',flag:'r'})
      } else {
        console.error('No binding query --bind(@) specified')
        process.exit(1);
      }
    }
    if( ! cli.construct ) {
      if(cli['construct@']) {
        cli.construct=fs.readFileSync(cli['construct@'],{encoding:'utf8',flag:'r'})
      } else {
        console.error('No constructing query --construct(@) specified')
        process.exit(1);
      }
    }
    const db = await localDB.create(db_config);
    if ( file.length != 0 ) {
      await db.load(file);
    }
    const bindingsStream = await db.queryBindings(cli.bind);
    bindingsStream.on('data', async (bindings) => {
      console.log('bindings:',bindings.toString());

      //const construction = await db.queryQuads(cli.construct,{initialBindings:bindings});
      const c = await db.engine.query(cli.construct,{initialBindings:bindings,sources:[db.store]});
      const {data} = await db.engine.resultToString(c,'application/ld+json');
      data.pipe(process.stdout);

    });
    //   construction.on('error', (err) => {
    //     console.log('construction error:',err);
    //   });
    //   construction.on('data', (quad) => {
    //     console.log('quinn');
    //     console.log(quad);
    //   });
    //   construction.on('end', () => {
    //     console.log('construction end');
    //   });
    // });
  }
);

await program.parseAsync(process.argv);
