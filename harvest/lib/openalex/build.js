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

function buildWorkTopics(db) {
  const rows = db.prepare(`
    SELECT w.doi, c.raw_json
    FROM work w
    JOIN openalex_response_cache c ON c.doi = w.doi
    WHERE c.http_status = 200 AND c.raw_json IS NOT NULL
  `).all();

  const clearStmt = db.prepare('DELETE FROM work_topic WHERE doi = ?');
  const insertStmt = db.prepare(`
    INSERT INTO work_topic (doi, topic_id, score, rank)
    VALUES (?, ?, ?, ?)
  `);

  const txn = db.transaction((rows) => {
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
  txn(rows);

  db.exec('DROP VIEW IF EXISTS dataset');
  db.exec(DATASET_VIEW_SQL);

  logger.info(`openalex build: processed ${rows.length} cached work(s)`);
  return { works: rows.length };
}

export { buildWorkTopics };
