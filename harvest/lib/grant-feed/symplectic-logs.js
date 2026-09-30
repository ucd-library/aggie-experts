/**
 * Parsers for the Symplectic Elements log files, used to confirm whether what
 * the grant feed sent was imported/deleted successfully.
 *
 * All parsers are pure (string -> structured data) so they can be unit-tested
 * against the sample logs without SFTP/DB. Grant identifiers in the logs are
 * the full ARK (e.g. ark:/87287/d7c08j/grant/A231857), which is exactly our
 * grant_feed grant_id, so results correlate directly.
 *
 * Log line shape is `TIMESTAMP:\t<message>`; a leading block of config/warning
 * lines is ignored — every parser just scans for the lines it cares about.
 *
 * The three feeds and their meaningful-content tests:
 *   - grants feed  (Summary/Import_Successes/Import_Errors): meaningful when the
 *     Summary reports >= 1 item processed.
 *   - delete user links (notes): meaningful when >= 1 per-link outcome line
 *     (deleted or not-found) is present.
 *   - delete grant records (notes): meaningful when >= 1 record was deleted.
 *     (This is the KFS legacy archive, ark:/87287/d7gt0q/... — archived only,
 *     not loaded into reporting.)
 */

/**
 * Parse the grants-feed Summary headline statistics.
 * @returns {{processed:number, created:number, updated:number, failed:number}|null}
 *          null when no statistics block is present (nothing processed yet).
 */
export function parseGrantsFeedSummary(text) {
  if (!text) return null;
  const num = (re) => {
    const m = text.match(re);
    return m ? parseInt(m[1], 10) : null;
  };
  const processed = num(/(\d+)\s+items processed in total/);
  if (processed === null) return null;
  return {
    processed,
    created: num(/(\d+)\s+items created in Elements database/) ?? 0,
    updated: num(/(\d+)\s+items updated in Elements database/) ?? 0,
    failed: num(/(\d+)\s+items failed to import/) ?? 0
  };
}

/**
 * Parse Import_Successes: one row per grant, created or updated.
 * @returns {Array<{grantId:string, status:'created'|'updated'}>}
 */
export function parseImportSuccesses(text) {
  const rows = [];
  if (!text) return rows;
  const re = /Data \[([^\]]+)\]\s+(created|updated)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    rows.push({ grantId: m[1], status: m[2] });
  }
  return rows;
}

/**
 * Parse Import_Errors: one row per failed grant with its reason.
 * @returns {Array<{grantId:string, reason:string}>}
 */
export function parseImportErrors(text) {
  const rows = [];
  if (!text) return rows;
  // Symplectic logs are Windows CRLF — split on \r?\n so the trailing \r does
  // not defeat the `$` anchor / leak into the captured reason.
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/Import failed for data \[([^\]]+)\]\s*::\s*(.*)$/);
    if (m) rows.push({ grantId: m[1], reason: m[2].trim() });
  }
  return rows;
}

/**
 * Combine the grants-feed logs into per-grant import outcomes.
 * @returns {Array<{grantId:string, status:'created'|'updated'|'failed', error:(string|null)}>}
 */
export function grantImportResults({ successes = '', errors = '' } = {}) {
  const out = [];
  for (const r of parseImportSuccesses(successes)) {
    out.push({ grantId: r.grantId, status: r.status, error: null });
  }
  for (const r of parseImportErrors(errors)) {
    out.push({ grantId: r.grantId, status: 'failed', error: r.reason });
  }
  return out;
}

/**
 * Parse the delete-user-links notes.
 * @returns {{count:number, outcomes:Array<{grantId, userId, roleId:number, status:'deleted'|'not-found'}>}}
 */
export function parseDeleteUserLinksNotes(text) {
  const outcomes = [];
  let count = 0;
  if (!text) return { count, outcomes };
  for (const line of text.split(/\r?\n/)) {
    let m = line.match(/Deleted link type (\d+) between user '([^']+)' and grant with proprietaryId '([^']+)'/);
    if (m) { outcomes.push({ grantId: m[3], userId: m[2], roleId: parseInt(m[1], 10), status: 'deleted' }); continue; }
    m = line.match(/No link type (\d+) found between user '([^']+)' and grant with proprietaryId '([^']+)'/);
    if (m) { outcomes.push({ grantId: m[3], userId: m[2], roleId: parseInt(m[1], 10), status: 'not-found' }); continue; }
    m = line.match(/Finished processing:\s*(\d+)\s+links deleted/);
    if (m) count = parseInt(m[1], 10);
  }
  return { count, outcomes };
}

/**
 * Parse the delete-grant-records notes (KFS legacy archive; archived only).
 * @returns {{count:number, grantIds:string[]}}
 */
export function parseDeleteGrantRecordsNotes(text) {
  const grantIds = [];
  let count = 0;
  if (!text) return { count, grantIds };
  for (const line of text.split(/\r?\n/)) {
    let m = line.match(/Deleted record in category '[^']*' with proprietaryId '([^']+)'/);
    if (m) { grantIds.push(m[1]); continue; }
    m = line.match(/Finished processing:\s*(\d+)\s+records deleted/);
    if (m) count = parseInt(m[1], 10);
  }
  return { count, grantIds };
}

// -------- meaningful-content tests (decide whether to keep a log in CasKFS) --

export function grantsFeedIsMeaningful(summaryText) {
  const s = parseGrantsFeedSummary(summaryText);
  return !!s && s.processed >= 1;
}

export function deleteUserLinksIsMeaningful(notesText) {
  return parseDeleteUserLinksNotes(notesText).outcomes.length >= 1;
}

export function deleteGrantRecordsIsMeaningful(notesText) {
  return parseDeleteGrantRecordsNotes(notesText).count >= 1;
}

export default {
  parseGrantsFeedSummary,
  parseImportSuccesses,
  parseImportErrors,
  grantImportResults,
  parseDeleteUserLinksNotes,
  parseDeleteGrantRecordsNotes,
  grantsFeedIsMeaningful,
  deleteUserLinksIsMeaningful,
  deleteGrantRecordsIsMeaningful
};
