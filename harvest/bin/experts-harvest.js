import { Command } from 'commander';
const program = new Command();

program
  .command('cache', 'manage Google Cloud Storage cache')
  .command('config', 'manage configuration settings')
  .command('delete-exception', 'set or remove a delete exception for a user')
  .command('extract', 'extract data from CDL, IAM, and Keycloak')
  .command('list', 'list users from CDL group')
  .command('load', 'load data into database(s)')
  .command('reporting', 'import/export reporting database')
  .command('transform', 'transform extracted data into Aggie Experts format')

program.parse(process.argv);
