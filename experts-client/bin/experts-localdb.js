import { Command} from 'commander';
const program = new Command();

//import {ExpertsClient from '../experts-client.js';
import { localDB } from '../experts-client.js';

const db_config = {
  level: process.env.EXPERTS_LEVEL ?? 'MEM'
}

program.command('load <file...>')
  .description('Import jsonld files into the local database')
  .action(async (file,options) => {
    console.log('Program:',options);
    console.log('file: %s', file);
    const db = await localDB.create(db_config);
    await db.load(file);
    db.match().forEach((quad) => {
      console.log('q:',quad);
    });

  });


program.command('query <file...>')
  .option('-q, --query <query>', 'The query to execute')
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
    const results = await db.query(cli.query);

  });

program.command('splay <file...>')
  .requiredOption('--bind_select, -b <select.rq>', 'select query for binding')
  .requiredOption('--construct, -c <file.rq>', 'construct query for each binding')
  .description('Using a select, and a construct, splay a graph, into individual files.  Any files includes are added to the localdb before the construct is run.')
  .action((json,options) => {
    console.log('splay:',options);
  });


await program.parseAsync(process.argv);
