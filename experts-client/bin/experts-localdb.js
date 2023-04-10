import fs from 'fs';
import { Command} from 'commander';
const program = new Command();

//import {ExpertsClient from '../experts-client.js';
import { localDB } from '../lib/experts-client.js';

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


await program.parseAsync(process.argv);