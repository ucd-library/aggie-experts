/**
 * CasKFS asset-path helpers for the grant-feed ETL.
 *
 * Every artifact lives under the weekly year-week partition in the same
 * FsCache/CasKFS store the rest of the harvest ETL uses:
 *
 *   /weekly/<year-week>/grant-feed/AEgrants.xml                 (raw input)
 *   /weekly/<year-week>/grant-feed/{Prod_UCD_}grants_metadata.csv
 *   /weekly/<year-week>/grant-feed/{Prod_UCD_}grants_links.csv
 *   /weekly/<year-week>/grant-feed/{Prod_UCD_}grants_persons.csv
 *   /weekly/<year-week>/grant-feed/delta/{Prod_UCD_}grants_metadata.csv
 *   /weekly/<year-week>/grant-feed/delta/{Prod_UCD_}grants_links.csv
 *   /weekly/<year-week>/grant-feed/delta/{Prod_UCD_}grants_persons.csv
 *   /weekly/<year-week>/grant-feed/delta/{Prod_UCD_}delete_user_grants_links.csv
 *
 * These functions take the weekly base path (as returned by
 * cache.getPath({root:'weekly', date})) and are otherwise pure, so they can
 * be unit-tested without the CasKFS runtime.
 */
import path from 'path';

// Subdirectory under the weekly year-week root. Deliberately separate from the
// 'grant' scholarly-work assets (webapp grant docs) — this is the AE ->
// Symplectic feed, a different pipeline.
export const GRANT_FEED_SUBDIR = 'grant-feed';

// Raw Aggie Enterprise input attachment name (as delivered by email).
export const RAW_INPUT_NAME = 'AEgrants.xml';

// The three generation CSV base names (prefix + these + .csv).
export const GENERATION_FILES = ['grants_metadata', 'grants_links', 'grants_persons'];

// The delta output base names (prefix + these + .csv).
export const DELTA_FILES = [
  'grants_metadata',
  'grants_links',
  'grants_persons',
  'delete_user_grants_links'
];

export function grantFeedRoot(weeklyPath) {
  return path.join(weeklyPath, GRANT_FEED_SUBDIR);
}

export function rawInputPath(weeklyPath) {
  return path.join(grantFeedRoot(weeklyPath), RAW_INPUT_NAME);
}

export function generationPath(weeklyPath, name, prefix = '') {
  return path.join(grantFeedRoot(weeklyPath), `${prefix}${name}.csv`);
}

export function deltaPath(weeklyPath, name, prefix = '') {
  return path.join(grantFeedRoot(weeklyPath), 'delta', `${prefix}${name}.csv`);
}

export default {
  GRANT_FEED_SUBDIR,
  RAW_INPUT_NAME,
  GENERATION_FILES,
  DELTA_FILES,
  grantFeedRoot,
  rawInputPath,
  generationPath,
  deltaPath
};
