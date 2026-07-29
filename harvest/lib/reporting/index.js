/**
 * ETL run observability.
 *
 * This module owns the etl_reporting schema (commands, errors, weekly state
 * views, year-week dimension, ES index registry). The API-shaped projection
 * (user identity, grants, works — consumed by webapp endpoints) lives in
 * harvest/lib/api/.
 *
 * Exports here are read by:
 *   - harvest/bin/experts-init.js                (initYearWeek)
 *   - harvest/bin/experts-harvest-reporting.js   (cleanup, enableFromCli)
 *   - harvest/lib/extract/* and load/*           (captureError, captureErrors,
 *                                                 enableFromCli, updateEsIndex)
 */

import { config, logger } from '@ucd-lib/experts-commons';
import { Temporal } from '@js-temporal/polyfill';
import { getYearWeek } from '@ucd-lib/experts-commons';
import PgClient from '../pg-client.js';

const WEEK_YEAR_START = 2026;
const WEEK_YEAR_END = WEEK_YEAR_START + 20;

// ----------------------------------------------------------------------------
// Year-week dimension bootstrap
// ----------------------------------------------------------------------------
async function initYearWeek(pgClient) {
  let weekYearInfo = getYearWeek({allValues: true});
  let date    = new Temporal.PlainDate(WEEK_YEAR_START, 1, 1);
  let endDate = new Temporal.PlainDate(WEEK_YEAR_END + 1, 1, 1);

  while (Temporal.PlainDate.compare(date, endDate) < 0) {
    weekYearInfo = getYearWeek({date, allValues: true, asString: true});
    await pgClient.insertYearWeek(
      weekYearInfo.yearWeek,
      weekYearInfo.weekStart,
      weekYearInfo.weekEnd
    );
    date = date.add({ days: 7 });
  }
}

// ----------------------------------------------------------------------------
// Error / state capture
// ----------------------------------------------------------------------------
function captureError(error) {
  return config.postgres.client.insertError({
    message    : error.message,
    stack      : error.stack,
    command_id : config.reporting.commandId
  });
}

function updateEsIndex(alias, indexName, docCount) {
  return config.postgres.client.updateEsIndex(alias, indexName, docCount);
}

function captureErrors() {
  process.on('uncaughtException', async (err) => {
    await captureError(err);
    await config.postgres.client.end();

    console.error(err);
    process.exit(1);
  });
  process.on('unhandledRejection', async (reason, promise) => {
    await captureError(reason);
    await config.postgres.client.end();

    console.error(reason);
    process.exit(1);
  });
}

// ----------------------------------------------------------------------------
// CLI bootstrap — wire up reporting state for a single command run
// ----------------------------------------------------------------------------
async function enableFromCli(command, user, options) {
  let weekYearInfo = getYearWeek({allValues: true, asString: true});

  config.reporting.enabled   = true;
  config.reporting.jobId     = options.reportingJobId || config.reporting.jobId;
  config.reporting.command   = command;
  config.reporting.opts      = options;
  config.reporting.yearWeek  = weekYearInfo.yearWeek;
  config.reporting.weekStart = weekYearInfo.weekStart;
  config.reporting.userId    = user;
  config.postgres.client     = new PgClient();

  let commandId = await config.postgres.client.insertCommand({
    job_id:     config.reporting.jobId,
    command:    config.reporting.command,
    year_week:  config.reporting.yearWeek,
    week_start: config.reporting.weekStart,
    user_id:    config.reporting.userId,
    options:    config.reporting.opts
  });
  config.reporting.commandId = commandId;
  captureErrors();
}

// ----------------------------------------------------------------------------
// Periodic cleanup
// ----------------------------------------------------------------------------

/**
 * Clean up old commands and user entries from the reporting database.
 * Deletes commands older than the specified number of weeks. If an option is
 * not specified, that table is not touched.
 *
 * @param {Object} opts
 * @param {number} opts.commands - Weeks to keep commands. Deletes older.
 * @param {number} opts.users    - Weeks to keep user entries. Deletes older.
 * @param {PgClient} opts.pgClient - Optional PgClient. New one created if absent.
 */
async function cleanup(opts={}) {
  let pgClient    = opts.pgClient || config.postgres.client;
  let closeClient = false;

  if (!pgClient) {
    pgClient = new PgClient();
    await pgClient.connect();
    closeClient = true;
  }

  let result = {};

  if (opts.commands) {
    console.log('Cleaning up old commands more than', opts.commands, 'weeks old...');
    let resp = await pgClient.query(`SELECT * FROM etl_reporting.cleanup_old_commands(${opts.commands})`);
    result = Object.assign(result, resp.rows[0]);
  }

  if (opts.users) {
    console.log('Cleaning up old user cache more than', opts.users, 'weeks old...');
    let resp = await pgClient.query(`SELECT * FROM etl_reporting.cleanup_old_users(${opts.users})`);
    result = Object.assign(result, resp.rows[0]);
  }

  if (closeClient) {
    await pgClient.end();
  }

  return result;
}


/**
 * @method checkIamForLapsedUsers
 * @description Post-ETL step: for users whose last_seen_cdl was last week (they just dropped
 * off CDL), query the IAM API to see if they are still present and update last_seen_iam
 * accordingly. Users no longer found in IAM are left unchanged — their stale last_seen_iam
 * accurately represents the last verified sighting.
 *
 * @param {Object} opts
 * @param {PgClient} opts.pgClient - Optional PgClient. A new one is created if omitted.
 * @returns {Promise<{checked: number, found: number, notFound: number, errors: number}>}
 */
async function checkIamForLapsedUsers(opts={}) {
  const { default: IAM } = await import('../extract/iam.js');
  const iamClient = new IAM();

  let pgClient = opts.pgClient || config.postgres.client;
  let closeClient = false;

  if (!pgClient) {
    pgClient = new PgClient();
    await pgClient.connect();
    closeClient = true;
  }

  const result = await pgClient.getUsersLapsedFromCdl();
  const users = result.rows;

  logger.info(`checkIamForLapsedUsers: checking ${users.length} users who lapsed from CDL last week`);

  let checked = 0, found = 0, notFound = 0, errors = 0;

  for (const user of users) {
    try {
      const iamResp = await iamClient.profile({ email: user.email });
      checked++;
      if (iamResp.notFound) {
        notFound++;
        logger.info(`checkIamForLapsedUsers: ${user.email} not found in IAM`);
      } else {
        found++;
        await pgClient.iamUserFetched(user.email);
        logger.info(`checkIamForLapsedUsers: ${user.email} still in IAM, updated last_seen_iam`);
      }
    } catch (err) {
      errors++;
      logger.error(`checkIamForLapsedUsers: error checking IAM for ${user.email}: ${err.message}`);
    }
  }

  if (closeClient) await pgClient.end();

  const summary = { checked, found, notFound, errors };
  logger.info('checkIamForLapsedUsers complete', summary);
  return summary;
}

export {
  cleanup,
  checkIamForLapsedUsers,
  enableFromCli,
  captureErrors,
  captureError,
  updateEsIndex,
  initYearWeek
};
