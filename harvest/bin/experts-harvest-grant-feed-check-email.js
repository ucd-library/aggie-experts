#!/usr/bin/env node
/**
 * experts harvest grant-feed check-email
 *
 * Poll the configured inbox for the weekly Aggie Enterprise extract: an email
 * from config.grantFeed.email.sender carrying an attachment named
 * config.grantFeed.email.attachmentName (AEgrants.xml). If a new one is found,
 * stage it in CasKFS as this week's raw input:
 *   /weekly/<year-week>/grant-feed/AEgrants.xml
 *
 * Prints a JSON result on the last stdout line so the Dagster asset can decide
 * whether to trigger the grant-feed ETL:
 *   { "found": true,  "weeklyPath": "...", "messageId": "...", "receivedAt": "..." }
 *   { "found": false, "reason": "disabled" | "stub-backend" | "no-new-mail" }
 *
 * The mailbox is not provisioned yet, so the default backend is a stub that
 * always reports found:false. See ../lib/grant-feed/email.js.
 */
import { Command } from 'commander';
import { Temporal } from '@js-temporal/polyfill';
import { logger, config, getTodaysDate } from '@ucd-lib/experts-commons';
import cache from '../lib/cache.js';
import { getEmailClient, rawInputPath } from '../lib/grant-feed/index.js';

const program = new Command();

program
  .name('check-email')
  .description('Check the configured inbox for a new AEgrants.xml and stage it in CasKFS')
  .option('-d, --date <date>', 'Week to stage the input under (YYYY-MM-DD); defaults to today', null)
  .option('--force', 'Stage the input even if one already exists in CasKFS for the week', false)
  .action(async (opts) => {
    let result = { found: false };
    try {
      const emailCfg = config.grantFeed.email;

      if (!emailCfg.enabled) {
        logger.info('grant-feed email check is disabled (config.grantFeed.email.enabled=false).');
        result = { found: false, reason: 'disabled' };
        return;
      }

      const date = opts.date ? Temporal.PlainDate.from(opts.date) : getTodaysDate();
      const weeklyPath = cache.getPath({ root: '/weekly', date });
      const rawPath = rawInputPath(weeklyPath);

      if (!opts.force && await cache.exists(rawPath)) {
        logger.info(`Raw input already staged for the week at ${rawPath}; skipping (use --force to overwrite).`);
        result = { found: false, reason: 'already-staged', weeklyPath };
        return;
      }

      const client = getEmailClient(emailCfg);
      await client.connect();
      try {
        const input = await client.fetchLatestInput();
        if (!input.found) {
          result = { found: false, reason: input.reason || 'no-new-mail' };
          return;
        }

        if (input.filename && input.filename !== emailCfg.attachmentName) {
          logger.warn(`Attachment '${input.filename}' != expected '${emailCfg.attachmentName}'; staging anyway.`);
        }

        await cache.write(rawPath, input.content);
        await client.markProcessed(input.messageId);
        logger.info(`Staged AE input from message ${input.messageId} -> ${rawPath}`);
        result = {
          found: true,
          weeklyPath,
          messageId: input.messageId,
          receivedAt: input.receivedAt || null
        };
      } finally {
        await client.close();
      }
    } finally {
      await cache.close();
      console.log(JSON.stringify(result));
    }
    process.exit();
  });

program.parseAsync(process.argv).catch(err => {
  logger.error('grant-feed check-email failed', err);
  process.exit(1);
});
