/**
 * CasKFS paths + clean filenames for the Symplectic log files we archive.
 *
 * Stored under the weekly partition, keyed by env (lower-cased for the clean
 * path convention):
 *   /weekly/<year-week>/grant-feed/symplectic-logs/<env>/<clean-name>
 *
 * Pure (no cache/SFTP) so it can be unit-tested; the weekly base path comes
 * from cache.getPath({root:'weekly', date}).
 */
import path from 'path';

export const SYMPLECTIC_LOG_SUBDIR = 'symplectic-logs';

// Clean cache filenames for each archived log (lower-case, hyphens).
export const LOG_CLEAN_NAMES = {
  summary: 'grants-feed-summary.txt',
  successes: 'grants-feed-import-successes.txt',
  errors: 'grants-feed-import-errors.txt',
  deleteUserLinks: 'delete-user-links-notes.txt',
  deleteGrantRecords: 'delete-grant-records-notes.txt'
};

export function symplecticLogDir(weeklyPath, env) {
  return path.join(weeklyPath, 'grant-feed', SYMPLECTIC_LOG_SUBDIR, String(env).toLowerCase());
}

export function symplecticLogPath(weeklyPath, env, cleanName) {
  return path.join(symplecticLogDir(weeklyPath, env), cleanName);
}

export default { SYMPLECTIC_LOG_SUBDIR, LOG_CLEAN_NAMES, symplecticLogDir, symplecticLogPath };
