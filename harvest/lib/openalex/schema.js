// SQLite schema for the OpenAlex-derived subject dataset.
// See harvest/bin/experts-harvest-openalex.js for the CLI that populates it.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS expert (
  expert_id TEXT PRIMARY KEY,
  name      TEXT,
  email     TEXT
);

-- Keyed on DOI rather than the harvest DB's internal work_id: the same DOI
-- can appear under multiple work_ids there (e.g. the same paper harvested
-- independently via different experts' Elements profiles), and DOI is the
-- natural key for everything downstream (OpenAlex lookups, the acceptance
-- criteria's "Work DOI" field).
CREATE TABLE IF NOT EXISTS work (
  doi   TEXT PRIMARY KEY,
  title TEXT
);

CREATE TABLE IF NOT EXISTS expert_work (
  expert_id TEXT NOT NULL REFERENCES expert(expert_id),
  doi       TEXT NOT NULL REFERENCES work(doi),
  PRIMARY KEY (expert_id, doi)
);

-- Static topic -> subfield -> field -> domain hierarchy, seeded from the
-- OpenAlex topic mapping CSV. Rows may also be inserted on the fly during
-- 'build' for topics OpenAlex returns that aren't in the CSV snapshot.
CREATE TABLE IF NOT EXISTS topic (
  topic_id      INTEGER PRIMARY KEY,
  topic_name    TEXT,
  subfield_id   INTEGER,
  subfield_name TEXT,
  field_id      INTEGER,
  field_name    TEXT,
  domain_id     INTEGER,
  domain_name   TEXT,
  keywords      TEXT,
  summary       TEXT,
  wikipedia_url TEXT
);

-- Per-work topic assignments and scores, as returned by OpenAlex's "topics"
-- array for that DOI. rank 1 == OpenAlex's primary_topic.
CREATE TABLE IF NOT EXISTS work_topic (
  doi      TEXT NOT NULL REFERENCES work(doi),
  topic_id INTEGER NOT NULL REFERENCES topic(topic_id),
  score    REAL,
  rank     INTEGER,
  PRIMARY KEY (doi, topic_id)
);

-- Raw OpenAlex API responses keyed by DOI, so re-running 'fetch' only hits
-- the API for DOIs that aren't already cached with a successful response.
CREATE TABLE IF NOT EXISTS openalex_response_cache (
  doi         TEXT PRIMARY KEY,
  http_status INTEGER,
  fetched_at  TEXT,
  raw_json    TEXT
);
`;

export { SCHEMA };
