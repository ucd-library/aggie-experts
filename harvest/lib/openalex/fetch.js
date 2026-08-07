import { logger } from '@ucd-lib/experts-commons';
import { fetchWorkByDoi } from './client.js';

const MAX_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchMissingTopics(db, opts = {}) {
  const { mailto, apiKey, limit, delayMs = 110, force = false } = opts;

  let sql = `SELECT DISTINCT doi FROM work WHERE doi IS NOT NULL`;
  if (!force) {
    sql += ` AND doi NOT IN (SELECT doi FROM openalex_response_cache WHERE http_status = 200)`;
  }
  sql += ` ORDER BY doi`;
  if (limit) sql += ` LIMIT ${parseInt(limit, 10)}`;

  const dois = db.prepare(sql).all().map(r => r.doi);
  logger.info(`openalex fetch: ${dois.length} DOI(s) to fetch`);

  const upsert = db.prepare(`
    INSERT INTO openalex_response_cache (doi, http_status, fetched_at, raw_json)
    VALUES (?, ?, datetime('now'), ?)
    ON CONFLICT(doi) DO UPDATE SET
      http_status = excluded.http_status,
      fetched_at  = excluded.fetched_at,
      raw_json    = excluded.raw_json
  `);

  let done = 0;
  for (const doi of dois) {
    let result;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      result = await fetchWorkByDoi(doi, { mailto, apiKey });
      if (result.status !== 429) break;
      logger.warn(`openalex fetch: rate limited on ${doi}, attempt ${attempt}/${MAX_ATTEMPTS}`);
      await sleep(delayMs * attempt * 5);
    }

    upsert.run(doi, result.status, result.json ? JSON.stringify(result.json) : null);
    if (result.status !== 200) {
      logger.warn(`openalex fetch: ${doi} returned HTTP ${result.status}`);
    }

    done++;
    if (done % 50 === 0) {
      logger.info(`openalex fetch: ${done}/${dois.length}`);
    }
    await sleep(delayMs);
  }

  logger.info(`openalex fetch: done, fetched ${done} DOI(s)`);
  return { fetched: done };
}

export { fetchMissingTopics };
