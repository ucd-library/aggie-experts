import PgClient from '../pg-client.js';
import { logger } from '@ucd-lib/experts-commons';

async function extractExpertsAndWorks(db) {
  const pg = new PgClient();
  await pg.connect();

  let resp;
  try {
    resp = await pg.query(`
      SELECT DISTINCT
        w.doi, w.title,
        u.expert_id, u.display_name, u.email
      FROM ${pg.apiSchema}.work w
      JOIN ${pg.apiSchema}.expert_work_role ewr ON ewr.work_id = w.work_id
      JOIN ${pg.apiSchema}."user" u ON u.expert_id = ewr.expert_id
      WHERE w.doi IS NOT NULL AND ewr.expert_id IS NOT NULL
    `);
  } finally {
    await pg.end();
  }

  const upsertExpert = db.prepare(`
    INSERT INTO expert (expert_id, name, email) VALUES (?, ?, ?)
    ON CONFLICT(expert_id) DO UPDATE SET name = excluded.name, email = excluded.email
  `);
  // Same DOI can show up under multiple internal work_ids in postgres (e.g.
  // harvested independently via different experts' Elements profiles) —
  // upsert collapses those onto a single work row, keyed by doi.
  const upsertWork = db.prepare(`
    INSERT INTO work (doi, title) VALUES (?, ?)
    ON CONFLICT(doi) DO UPDATE SET title = COALESCE(excluded.title, work.title)
  `);
  const upsertExpertWork = db.prepare(`
    INSERT INTO expert_work (expert_id, doi) VALUES (?, ?)
    ON CONFLICT(expert_id, doi) DO NOTHING
  `);

  const txn = db.transaction((rows) => {
    for (const row of rows) {
      upsertExpert.run(row.expert_id, row.display_name, row.email);
      upsertWork.run(row.doi, row.title);
      upsertExpertWork.run(row.expert_id, row.doi);
    }
  });
  txn(resp.rows);

  logger.info(`openalex extract: upserted ${resp.rows.length} expert/work rows`);
  return { rows: resp.rows.length };
}

export { extractExpertsAndWorks };
