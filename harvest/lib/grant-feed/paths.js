/**
 * CasKFS asset-path helpers for the grant-feed ETL.
 *
 * CasKFS filenames use the project convention: lower-case and hyphens only
 * (no capitals, no underscores). The legacy Symplectic naming (Prod_UCD_
 * prefix + underscores + mixed case) is applied only at upload time via
 * toSymplecticFileName(), so the files delivered to Symplectic keep the names
 * their importer expects while the cache stays clean.
 *
 * Layout under the weekly year-week partition:
 *
 *   /weekly/<year-week>/grant-feed/ae-grants.xml                 (raw input)
 *   /weekly/<year-week>/grant-feed/grants-metadata.csv
 *   /weekly/<year-week>/grant-feed/grants-links.csv
 *   /weekly/<year-week>/grant-feed/grants-persons.csv
 *   /weekly/<year-week>/grant-feed/delta/grants-metadata.csv
 *   /weekly/<year-week>/grant-feed/delta/grants-links.csv
 *   /weekly/<year-week>/grant-feed/delta/grants-persons.csv
 *   /weekly/<year-week>/grant-feed/delta/delete-user-grants-links.csv
 *
 * On upload these map to (PROD): Prod_UCD_grants_metadata.csv, etc.
 *
 * These functions take the weekly base path (as returned by
 * cache.getPath({root:'/weekly', date})) and are otherwise pure, so they can
 * be unit-tested without the CasKFS runtime. CasKFS names are env-agnostic —
 * QA vs PROD only affects the Symplectic upload name/target, not storage.
 */
import path from 'path';

// Subdirectory under the weekly year-week root. Deliberately separate from the
// 'grant' scholarly-work assets (webapp grant docs) — this is the AE ->
// Symplectic feed, a different pipeline.
export const GRANT_FEED_SUBDIR = 'grant-feed';

// Raw Aggie Enterprise input, stored under the clean cache name. (The email
// attachment / GCS object may be named differently; see config.grantFeed.email.)
export const RAW_INPUT_NAME = 'ae-grants.xml';

// The three generation CSV base names (clean; + .csv).
export const GENERATION_FILES = ['grants-metadata', 'grants-links', 'grants-persons'];

// The delta output base names (clean; + .csv).
export const DELTA_FILES = [
  'grants-metadata',
  'grants-links',
  'grants-persons',
  'delete-user-grants-links'
];

export function grantFeedRoot(weeklyPath) {
  return path.join(weeklyPath, GRANT_FEED_SUBDIR);
}

export function rawInputPath(weeklyPath) {
  return path.join(grantFeedRoot(weeklyPath), RAW_INPUT_NAME);
}

export function generationPath(weeklyPath, name) {
  return path.join(grantFeedRoot(weeklyPath), `${name}.csv`);
}

export function deltaPath(weeklyPath, name) {
  return path.join(grantFeedRoot(weeklyPath), 'delta', `${name}.csv`);
}

/**
 * Translate a clean cache CSV base name (e.g. 'grants-metadata') into the
 * legacy Symplectic filename the Elements importer expects: hyphens become
 * underscores and an env-specific prefix is added ('Prod_UCD_' for PROD,
 * 'QA_UCD_' for QA).
 *
 *   ('grants-metadata', 'PROD') -> 'Prod_UCD_grants_metadata.csv'
 *   ('grants-metadata', 'QA')   -> 'QA_UCD_grants_metadata.csv'
 *   ('delete-user-grants-links', 'PROD') -> 'Prod_UCD_delete_user_grants_links.csv'
 */
export function toSymplecticFileName(name, env) {
  const prefix = env === 'PROD' ? 'Prod_UCD_' : env === 'QA' ? 'QA_UCD_' : '';
  return `${prefix}${name.replace(/-/g, '_')}.csv`;
}

export default {
  GRANT_FEED_SUBDIR,
  RAW_INPUT_NAME,
  GENERATION_FILES,
  DELTA_FILES,
  grantFeedRoot,
  rawInputPath,
  generationPath,
  deltaPath,
  toSymplecticFileName
};
