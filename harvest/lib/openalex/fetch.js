import { logger } from '@ucd-lib/experts-commons';
import { fetchWorkByDoi } from './client.js';

const MAX_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch a single DOI, retrying on both rate-limiting (429) and network-level
// failures (connection reset, DNS hiccup, machine waking from sleep
// mid-request) with the same backoff. Returns null if every attempt failed
// at the network level — the caller leaves that DOI uncached so the next
// 'fetch' run retries it, rather than crashing or recording a fake status.
//
// Deliberately silent per-attempt (no per-retry logging) — under
// concurrency, most 429s/network blips resolve within a retry or two, and
// logging every attempt drowns the log in noise for what's usually a
// non-event. The caller logs exactly one line per DOI once the outcome is
// final (success, non-200 status, or exhausted retries).
async function fetchOneDoi(doi, { mailto, apiKey, delayMs }) {
  let result = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      result = await fetchWorkByDoi(doi, { mailto, apiKey });
    } catch (err) {
      result = null;
      await sleep(delayMs * attempt * 5);
      continue;
    }
    if (result.status !== 429) return result;
    await sleep(delayMs * attempt * 5);
  }
  return result;
}

async function fetchMissingTopics(db, opts = {}) {
  const { mailto, apiKey, limit, delayMs = 110, force = false, concurrency = 10 } = opts;

  let sql = `SELECT DISTINCT doi FROM work WHERE doi IS NOT NULL`;
  if (!force) {
    sql += ` AND doi NOT IN (SELECT doi FROM openalex_response_cache WHERE http_status = 200)`;
  }
  sql += ` ORDER BY doi`;
  if (limit) sql += ` LIMIT ${parseInt(limit, 10)}`;

  const dois = db.prepare(sql).all().map(r => r.doi);
  logger.info(`openalex fetch: ${dois.length} DOI(s) to fetch (concurrency ${concurrency})`);

  const upsert = db.prepare(`
    INSERT INTO openalex_response_cache (doi, http_status, fetched_at, raw_json)
    VALUES (?, ?, datetime('now'), ?)
    ON CONFLICT(doi) DO UPDATE SET
      http_status = excluded.http_status,
      fetched_at  = excluded.fetched_at,
      raw_json    = excluded.raw_json
  `);

  // Worker-pool: each worker pulls the next DOI off the shared index and
  // processes it independently, so 'concurrency' requests are in flight at
  // once instead of one at a time. better-sqlite3's .run() is synchronous,
  // so upserts from different workers never race — Node's single JS thread
  // just interleaves them safely as each worker's fetch resolves.
  let nextIndex = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= dois.length) return;
      const doi = dois[i];

      const result = await fetchOneDoi(doi, { mailto, apiKey, delayMs });

      if (result === null) {
        logger.error(`openalex fetch: giving up on ${doi} after ${MAX_ATTEMPTS} network errors, will retry next run`);
      } else {
        upsert.run(doi, result.status, result.json ? JSON.stringify(result.json) : null);
        if (result.status !== 200) {
          logger.warn(`openalex fetch: ${doi} returned HTTP ${result.status}`);
        }
      }

      done++;
      if (done % 50 === 0) {
        logger.info(`openalex fetch: ${done}/${dois.length}`);
      }
      await sleep(delayMs);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, dois.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  logger.info(`openalex fetch: done, fetched ${done} DOI(s)`);
  return { fetched: done };
}

export { fetchMissingTopics };
