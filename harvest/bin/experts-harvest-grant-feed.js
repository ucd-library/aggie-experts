#!/usr/bin/env node
/**
 * experts harvest grant-feed
 *
 * Dispatcher for the Aggie Enterprise -> Symplectic grant-feed ETL. Each
 * subcommand is its own executable (commander git-style subcommands):
 *
 *   transform    parse the weekly AE XML into generation CSVs (CasKFS)
 *   delta        diff this week's generation vs last week's (CasKFS)
 *   process      transform + delta + SFTP upload to Symplectic
 *   check-email  poll the inbox for a new AEgrants.xml and stage it in CasKFS
 *
 * All artifacts live under /weekly/<year-week>/grant-feed/ in CasKFS.
 */
import { Command } from 'commander';

const program = new Command();

program
  .name('grant-feed')
  .description('Aggie Enterprise -> Symplectic grant-feed ETL')
  .command('transform', 'transform the weekly AE XML into Symplectic generation CSVs (stored in CasKFS)')
  .command('delta', "diff this week's generation against last week's and store the Symplectic delta")
  .command('process', 'run the full weekly ETL: transform, diff vs last week, upload delta to Symplectic')
  .command('check-email', 'check the configured inbox for a new AEgrants.xml and stage it in CasKFS');

program.parse(process.argv);
