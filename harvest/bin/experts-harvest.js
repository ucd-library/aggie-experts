import { Command } from 'commander';
const program = new Command();

program
  .command('extract', 'extract data from CDL, IAM, and Keycloak')
  .command('transform', 'transform extracted data into Aggie Experts format')

program.parse(process.argv);
