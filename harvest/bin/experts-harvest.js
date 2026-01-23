import { Command } from 'commander';
import cache from '../lib/cache.js';
const program = new Command();

program
  .command('config', 'manage configuration settings')
  .command('dagster', 'manage Dagster')
  .command('delete-exception', 'set or remove a delete exception for a user')
  .command('extract', 'extract data from CDL, IAM, and Keycloak')
  .command('list', 'list users from CDL group')
  .command('load', 'load data into database(s)')
  .command('reporting', 'import/export reporting database')
  .command('transform', 'transform extracted data into Aggie Experts format')

program
  .command('year-week')
  .description('Get the year-week number for a given date, defaults to current date')
  .option('--date <date>', 'Date to get week number for (format: YYYY-MM-DD).  Defaults to current date.', null)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action((opts) => {
    let date;
    if( opts.date ) {
      date = new Date(opts.date);
      if( isNaN(date.getTime()) ) {
        throw new Error('Invalid date format specified.  Must be in format YYYY-MM-DD');
      }
    } else {
      date = new Date();
    }

    console.log(cache.getYearWeek(date, { allValues: opts.verbose }));
  });

program.parse(process.argv);
