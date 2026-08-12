import { logger } from '@ucd-lib/experts-commons';

// OpenAlex ids are URLs like "https://openalex.org/T12003" or
// "https://openalex.org/subfields/1102" — the numeric suffix is what the
// topic mapping CSV keys on.
function idFromUrl(url) {
  if (!url) return null;
  const m = String(url).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

// Insert a topic row from the API response itself when it's missing from
// the CSV snapshot (OpenAlex's taxonomy can add topics after the CSV was
// generated). Existing CSV-sourced rows are left untouched.
function ensureTopicRow(db, topic) {
  const topicId = idFromUrl(topic.id);
  if (topicId == null) return null;

  const exists = db.prepare('SELECT 1 FROM topic WHERE topic_id = ?').get(topicId);
  if (!exists) {
    db.prepare(`
      INSERT INTO topic (topic_id, topic_name, subfield_id, subfield_name, field_id, field_name, domain_id, domain_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      topicId,
      topic.display_name || null,
      idFromUrl(topic.subfield?.id),
      topic.subfield?.display_name || null,
      idFromUrl(topic.field?.id),
      topic.field?.display_name || null,
      idFromUrl(topic.domain?.id),
      topic.domain?.display_name || null
    );
    logger.warn(`openalex build: topic ${topicId} (${topic.display_name}) missing from mapping CSV, inserted from API response`);
  }
  return topicId;
}

const DATASET_VIEW_SQL = `
  CREATE VIEW dataset AS
  SELECT
    w.doi           AS work_doi,
    e.expert_id     AS expert_id,
    e.name          AS expert_name,
    e.email         AS expert_email,
    t.topic_name    AS topic,
    wt.score        AS topic_score,
    t.subfield_name AS subfield,
    NULL            AS subfield_score,
    t.field_name    AS field,
    NULL            AS field_score,
    t.domain_name   AS domain,
    NULL            AS domain_score
  FROM expert_work ew
  JOIN expert e ON e.expert_id = ew.expert_id
  JOIN work w   ON w.doi       = ew.doi
  LEFT JOIN work_topic wt ON wt.doi = w.doi
  LEFT JOIN topic t       ON t.topic_id = wt.topic_id
`;

// Batch size for processing cached responses. Kept small on purpose: each
// row's raw_json is a multi-KB blob, and pulling every one of them
// (potentially hundreds of thousands) into memory can cause an OOM crash. 
// Also kept under SQLite's historical 999-parameter limit, since each 
// batch is fetched via a single "doi IN (?,?,...)" query.
const BATCH_SIZE = 500;

function buildWorkTopics(db) {
  // Only the (small) doi strings, not the raw_json blobs, so holding the
  // full list in memory is cheap even at hundreds of thousands of rows.
  const dois = db.prepare(`
    SELECT w.doi
    FROM work w
    JOIN openalex_response_cache c ON c.doi = w.doi
    WHERE c.http_status = 200 AND c.raw_json IS NOT NULL
  `).all().map(r => r.doi);

  const clearStmt = db.prepare('DELETE FROM work_topic WHERE doi = ?');
  // OR IGNORE: a handful of OpenAlex works list the same topic twice in
  // their "topics" array — real upstream data noise, not our bug. Keep the
  // first (highest-ranked) occurrence and silently drop the duplicate
  // rather than crashing the whole batch on the primary key conflict.
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO work_topic (doi, topic_id, score, rank)
    VALUES (?, ?, ?, ?)
  `);

  const processBatch = db.transaction((rows) => {
    for (const row of rows) {
      const parsed = JSON.parse(row.raw_json);
      const topics = Array.isArray(parsed.topics) ? parsed.topics : [];
      clearStmt.run(row.doi);
      topics.forEach((topic, idx) => {
        const topicId = ensureTopicRow(db, topic);
        if (topicId == null) return;
        insertStmt.run(row.doi, topicId, topic.score ?? null, idx + 1);
      });
    }
  });

  let count = 0;
  for (let i = 0; i < dois.length; i += BATCH_SIZE) {
    const chunk = dois.slice(i, i + BATCH_SIZE);
    // Fully materialize this chunk's raw_json via .all() (not .iterate())
    // BEFORE opening the write transaction below — better-sqlite3 refuses
    // to start a transaction while another statement on the same
    // connection is still open/paused, which a live .iterate() cursor
    // spanning the transaction would otherwise be.
    const placeholders = chunk.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT doi, raw_json FROM openalex_response_cache WHERE doi IN (${placeholders})
    `).all(...chunk);

    processBatch(rows);
    count += rows.length;
    logger.info(`openalex build: processed ${count}/${dois.length} work(s)`);
  }

  db.exec('DROP VIEW IF EXISTS dataset');
  db.exec(DATASET_VIEW_SQL);

  logger.info(`openalex build: processed ${count} cached work(s)`);
  return { works: count };
}

export { buildWorkTopics };
