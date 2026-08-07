import fs from 'fs-extra';
import { parse } from 'csv-parse/sync';
import { logger } from '@ucd-lib/experts-commons';

const UPSERT_SQL = `
  INSERT INTO topic (
    topic_id, topic_name, subfield_id, subfield_name,
    field_id, field_name, domain_id, domain_name,
    keywords, summary, wikipedia_url
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(topic_id) DO UPDATE SET
    topic_name    = excluded.topic_name,
    subfield_id   = excluded.subfield_id,
    subfield_name = excluded.subfield_name,
    field_id      = excluded.field_id,
    field_name    = excluded.field_name,
    domain_id     = excluded.domain_id,
    domain_name   = excluded.domain_name,
    keywords      = excluded.keywords,
    summary       = excluded.summary,
    wikipedia_url = excluded.wikipedia_url
`;

async function loadTopicsFromCsv(db, csvPath) {
  const content = await fs.readFile(csvPath, 'utf8');
  const records = parse(content, { columns: true, skip_empty_lines: true });

  const upsert = db.prepare(UPSERT_SQL);
  const txn = db.transaction((rows) => {
    for (const r of rows) {
      upsert.run(
        parseInt(r.topic_id, 10),
        r.topic_name || null,
        r.subfield_id ? parseInt(r.subfield_id, 10) : null,
        r.subfield_name || null,
        r.field_id ? parseInt(r.field_id, 10) : null,
        r.field_name || null,
        r.domain_id ? parseInt(r.domain_id, 10) : null,
        r.domain_name || null,
        r.keywords || null,
        r.summary || null,
        r.wikipedia_url || null
      );
    }
  });
  txn(records);

  logger.info(`openalex topics: loaded ${records.length} topics from ${csvPath}`);
  return { topics: records.length };
}

export { loadTopicsFromCsv };
