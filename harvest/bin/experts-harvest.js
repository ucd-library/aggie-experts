import { Command } from 'commander';
import { getYearWeek } from '../lib/year-week.js';
import { Temporal } from '@js-temporal/polyfill';
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
  .option('-d, --date <date>', 'Date to get week number for (format: YYYY-MM-DD).  Defaults to current date.', null)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action((opts) => {
    let fnOpts = {
      date : opts.date ? Temporal.PlainDate.from(opts.date) : undefined,
      allValues: opts.verbose,
      asString: true
    }

    console.log(getYearWeek(fnOpts));
  });

program.parse(process.argv);
