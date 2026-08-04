/**
 * Load a week's grant-feed delta into the `grant_feed` reporting schema
 * (see ./schema.sql).
 *
 * Takes the parsed delta rows (keyed by the delivered CSV headers) plus the
 * year-week and whether the delta was uploaded to Symplectic, and upserts them
 * into grant_feed.metadata / links / delete_links (grants_persons is
 * intentionally not stored — see the note on loadGrantFeedReporting). Upserts are 
 * keyed on the tables' PKs, so re-running the same week is idempotent (no double
 * counting) and distinct weeks accumulate as history.
 *
 * The caller owns reading/parsing the CSVs (from CasKFS) and the PgClient
 * lifecycle; this module only writes rows, so it is easy to unit-test.
 */

/**
 * @param {PgClient} pg            connected PgClient (schema 'grant_feed')
 * @param {Object}   opts
 * @param {string}   opts.yearWeek       e.g. '2026-27'
 * @param {string}   opts.env            'PROD' | 'QA' — the Symplectic target
 * @param {boolean}  opts.uploaded       true if the delta was SFTP'd to Symplectic
 * @param {Object[]} opts.metadata       rows from grants-metadata.csv
 * @param {Object[]} opts.links          rows from grants-links.csv
 * @param {Object[]} opts.deleteLinks    rows from delete-user-grants-links.csv
 * @param {Set<string>} [opts.newGrantIds]  grant_ids that are new this week
 *        (absent from last week's generation), as computed by the delta stage;
 *        a metadata grant in this set is classified 'new', else 'updated'.
 *        Empty/omitted => everything 'updated'.
 *
 * (grants_persons is intentionally not stored — it isn't needed for reporting.)
 */
export async function loadGrantFeedReporting(pg, { yearWeek, env, uploaded, metadata = [], links = [], deleteLinks = [], newGrantIds = new Set() }) {
  // date_uploaded is set only when the delta actually went to Symplectic;
  // a produce-only run (--no-upload) records NULL.
  const dateUploaded = uploaded ? new Date() : null;

  await pg.query('BEGIN');
  try {
    for (const row of metadata) {
      const grantId = row['id'];
      const fundingSource = row['funder'] || '';
      const changeType = newGrantIds.has(grantId) ? 'new' : 'updated';
      // id -> grant_id (PK), "funder" -> funding_source (PK); the rest is data.
      const { id, ['funder']: _funder, ...rest } = row;
      await pg.query(
        `INSERT INTO grant_feed.metadata (grant_id, funding_source, env, change_type, data, year_week, date_uploaded)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (grant_id, funding_source, year_week, env)
         DO UPDATE SET change_type = EXCLUDED.change_type, data = EXCLUDED.data, date_uploaded = EXCLUDED.date_uploaded`,
        [grantId, fundingSource, env, changeType, JSON.stringify(rest), yearWeek, dateUploaded]
      );
    }

    for (const row of links) {
      await pg.query(
        `INSERT INTO grant_feed.links (grant_id, user_id, role_id, env, year_week)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (grant_id, user_id, role_id, year_week, env) DO NOTHING`,
        [row['id-2'], row['id-1'], parseInt(row['link-type-id'], 10), env, yearWeek]
      );
    }

    for (const row of deleteLinks) {
      // date_delete_requested defaults to NOW() on first insert; keep the
      // original request time if the same delete recurs in-week.
      await pg.query(
        `INSERT INTO grant_feed.delete_links (grant_id, user_id, role_id, env, year_week)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (grant_id, user_id, role_id, year_week, env) DO NOTHING`,
        [row['record_proprietary_id'], row['user_proprietary_id'], parseInt(row['link_type_id'], 10), env, yearWeek]
      );
    }

    await pg.query('COMMIT');
  } catch (err) {
    await pg.query('ROLLBACK');
    throw err;
  }

  return {
    env,
    metadata: metadata.length,
    links: links.length,
    deleteLinks: deleteLinks.length,
    uploaded: !!uploaded
  };
}

/**
 * Load the Symplectic import/delete confirmation (parsed from the Elements
 * logs) into the reporting schema:
 *   - import_result   : per-grant created/updated/failed outcome
 *   - import_summary   : one row per (env, log_date) with the run totals
 *   - delete_links     : sets delete_status / date_confirmed on the matching
 *                        requested-delete row (latest year_week for the tuple)
 *
 * Correlation is by grant_id (+ user_id/role_id for deletes) and env. The
 * confirmation's year_week is the LOG date's year-week (imports run ~1 day
 * after upload), which is usually — but not always — the upload week.
 *
 * @param {PgClient} pg
 * @param {Object}   opts
 * @param {string}   opts.env         'PROD' | 'QA'
 * @param {string}   opts.yearWeek    year-week of the log date
 * @param {string}   opts.logDate     'YYYY-MM-DD' of the Symplectic import
 * @param {Array}    [opts.grantResults]   [{grantId, status, error}]
 * @param {Object}   [opts.summary]        {processed, created, updated, failed, linksDeleted, linksNotFound}
 * @param {Array}    [opts.deleteOutcomes] [{grantId, userId, roleId, status}]
 */
export async function loadImportConfirmation(pg, { env, yearWeek, logDate, grantResults = [], summary = null, deleteOutcomes = [] }) {
  await pg.query('BEGIN');
  try {
    for (const r of grantResults) {
      await pg.query(
        `INSERT INTO grant_feed.import_result (grant_id, env, year_week, status, error, log_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (grant_id, year_week, env)
         DO UPDATE SET status = EXCLUDED.status, error = EXCLUDED.error, log_date = EXCLUDED.log_date`,
        [r.grantId, env, yearWeek, r.status, r.error ?? null, logDate]
      );
    }

    if (summary) {
      await pg.query(
        `INSERT INTO grant_feed.import_summary
           (env, log_date, year_week, grants_processed, grants_created, grants_updated, grants_failed, links_deleted, links_not_found)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (env, log_date)
         DO UPDATE SET year_week = EXCLUDED.year_week,
           grants_processed = EXCLUDED.grants_processed, grants_created = EXCLUDED.grants_created,
           grants_updated = EXCLUDED.grants_updated, grants_failed = EXCLUDED.grants_failed,
           links_deleted = EXCLUDED.links_deleted, links_not_found = EXCLUDED.links_not_found`,
        [env, logDate, yearWeek,
         summary.processed ?? null, summary.created ?? null, summary.updated ?? null, summary.failed ?? null,
         summary.linksDeleted ?? null, summary.linksNotFound ?? null]
      );
    }

    for (const o of deleteOutcomes) {
      // Confirm the most-recent requested delete for this link/env (the delete
      // may have been requested in an earlier week than the log date).
      await pg.query(
        `UPDATE grant_feed.delete_links
         SET delete_status = $1, date_confirmed = $2
         WHERE grant_id = $3 AND user_id = $4 AND role_id = $5 AND env = $6
           AND year_week = (
             SELECT MAX(year_week) FROM grant_feed.delete_links
             WHERE grant_id = $3 AND user_id = $4 AND role_id = $5 AND env = $6
           )`,
        [o.status, logDate, o.grantId, o.userId, o.roleId, env]
      );
    }

    await pg.query('COMMIT');
  } catch (err) {
    await pg.query('ROLLBACK');
    throw err;
  }

  return {
    env,
    imports: grantResults.length,
    summary: !!summary,
    deletes: deleteOutcomes.length
  };
}

export default loadGrantFeedReporting;
