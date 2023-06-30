import { Command} from 'commander';
const program = new Command();

program.command('work <work_id...>')
  .description('Import a work')
  .option('--group, -g <group_id>', 'Import a set of citations via group-id')
  .option('--user, -u <user_id...>', 'Import a set of citations for a user')
  .option('--modified-since, -m <modified_since>', 'Filter by citations modified from this date')
  .action((work_id,options) => {
    console.log('process:',process.env.EXPERTS_VERBOSE);
    console.log('fin:',process.env.EXPERTS_FIN);
    console.log('Program:',options);
    console.log('work_id: %s', work_id);

  });

program.command('person <email...>')
  .option('--group, -g <group_id>', 'Import a set of citations via group-id')
  .option('--modified-since, -m <modified_since>', 'Filter by citations modified from this date')
  .description('import a person.')
  .action(() => {
    console.log('person import');
  });

program.command('grant <json>')
  .description('import a grants from a jsonld file.')
  .action((json,options) => {
    console.log('grants: %s', json);
  });


program.parse(process.argv);
