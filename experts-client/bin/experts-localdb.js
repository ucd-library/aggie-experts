import { Command} from 'commander';
const program = new Command();

import ExpertsClient from '../experts-client.js';

const ec = new ExpertsClient(
  {
    localDB: {
      level: 'MEM'
    }
  }
);

program.command('load <file...>')
  .description('Import jsonld files into the local database')
  .action((file,options) => {
    console.log('process:',process.env.EXPERTS_VERBOSE);
    console.log('fin:',process.env.EXPERTS_FIN);
    console.log('Program:',options);
    console.log('file: %s', file);
    const db=ec.getLocalDB();
    console.log('db:',db);

  });

program.command('query <file...>')
  .option('--group, -g <group_id>', 'Import a set of citations via group-id')
  .option('--modified-since, -m <modified_since>', 'Filter by citations modified from this date')
  .description('import a person.')
  .action(() => {
    console.log('person import');
  });

program.command('splay <file...>')
  .requiredOption('--bind_select, -b <select.rq>', 'select query for binding')
  .requiredOption('--construct, -c <file.rq>', 'construct query for each binding')
  .description('Using a select, and a construct, splay a graph, into individual files.  Any files includes are added to the localdb before the construct is run.')
  .action((json,options) => {
    console.log('splay:',options);
  });


program.parse(process.argv);
