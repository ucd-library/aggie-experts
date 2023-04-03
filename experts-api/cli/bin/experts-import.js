import { Command} from 'commander';
const program = new Command();

program.command('work <work_id...>')
  .description('Import a work')
  .option('--group-id, -g <group_id>', 'Import a set of citations via group-id')
  .action((work_id,options) => {
    console.log('process:',process.env.EXPERTS_VERBOSE);
    console.log('fin:',process.env.EXPERTS_FIN);
    console.log('Program:',options);
    console.log('work_id: %s', work_id);

  });

program.command('person')
  .description('import a person.')
  .action(() => {
    config.logout();
  });

program.parse(process.argv);
