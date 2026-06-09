#! /usr/bin/env -S node --no-warnings

import { Command } from 'commander';
import SlackNotifier from '@ucd-lib/experts-commons/lib/slack-notifier.js';

const program = new Command();

program
  .name('admin')
  .description('Aggie Experts admin utilities');

program
  .command('notify')
  .description('Send a Slack notification')
  .requiredOption('--title <title>', 'Message title')
  .option('--message <message>', 'Message body', '')
  .option('--severity <severity>', 'Severity level: info, warning, or error', 'info')
  .option('--source <source>', 'Source label shown in the notification', 'dagster')
  .option('--context <key=value>', 'Context key/value pair (repeatable)', (val, acc) => {
    const [key, ...rest] = val.split('=');
    acc[key] = rest.join('=');
    return acc;
  }, {})
  .action(async (opts) => {
    const sent = await SlackNotifier.send({
      title: opts.title,
      message: opts.message,
      severity: opts.severity,
      source: opts.source,
      context: Object.keys(opts.context).length ? opts.context : null,
    });

    if (!sent) {
      process.exit(1);
    }

    process.exit();
  });

program.parse(process.argv);
