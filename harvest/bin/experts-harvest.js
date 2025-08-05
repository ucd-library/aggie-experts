import { Command } from 'commander';
const program = new Command();

program
  .command('config', 'manage configuration settings')
  .command('list', 'list users from CDL group')
  .command('extract', 'extract data from CDL, IAM, and Keycloak')
  .command('transform', 'transform extracted data into Aggie Experts format')
  .command('load', 'load data into database(s)')

program.parse(process.argv);
