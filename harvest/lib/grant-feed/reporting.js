/**
 * Load a week's grant-feed delta into the `grant_feed` reporting schema
 * (see ./schema.sql).
 *
 * Takes the parsed delta rows (keyed by the delivered CSV headers) plus the
 * year-week and whether the delta was uploaded to Symplectic, and upserts them
 * into grant_feed.metadata / links / persons / delete_links. Upserts are keyed
 * on the tables' PKs, so re-running the same week is idempotent (no double
 * counting) and distinct weeks accumulate as history.
 *
 * The caller owns reading/parsing the CSVs (from CasKFS) and the PgClient
 * lifecycle; this module only writes rows, so it is easy to unit-test.
 */

/**
 * @param {PgClient} pg            connected PgClient (schema 'grant_feed')
 * @param {Object}   opts
 * @param {string}   opts.yearWeek       e.g. '2026-27'
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
export async function loadGrantFeedReporting(pg, { yearWeek, uploaded, metadata = [], links = [], deleteLinks = [], newGrantIds = new Set() }) {
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
        `INSERT INTO grant_feed.metadata (grant_id, funding_source, change_type, data, year_week, date_uploaded)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (grant_id, funding_source, year_week)
         DO UPDATE SET change_type = EXCLUDED.change_type, data = EXCLUDED.data, date_uploaded = EXCLUDED.date_uploaded`,
        [grantId, fundingSource, changeType, JSON.stringify(rest), yearWeek, dateUploaded]
      );
    }

    for (const row of links) {
      await pg.query(
        `INSERT INTO grant_feed.links (grant_id, user_id, role_id, year_week)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (grant_id, user_id, role_id, year_week) DO NOTHING`,
        [row['id-2'], row['id-1'], parseInt(row['link-type-id'], 10), yearWeek]
      );
    }

    for (const row of deleteLinks) {
      // date_delete_requested defaults to NOW() on first insert; keep the
      // original request time if the same delete recurs in-week.
      await pg.query(
        `INSERT INTO grant_feed.delete_links (grant_id, user_id, role_id, year_week)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (grant_id, user_id, role_id, year_week) DO NOTHING`,
        [row['record_proprietary_id'], row['user_proprietary_id'], parseInt(row['link_type_id'], 10), yearWeek]
      );
    }

    await pg.query('COMMIT');
  } catch (err) {
    await pg.query('ROLLBACK');
    throw err;
  }

  return {
    metadata: metadata.length,
    links: links.length,
    deleteLinks: deleteLinks.length,
    uploaded: !!uploaded
  };
}

export default loadGrantFeedReporting;
