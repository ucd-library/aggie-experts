-- ============================================================================
-- api schema
-- ----------------------------------------------------------------------------
-- The API-shaped postgres projection consumed by the webapp MIV and SiteFarm
-- endpoints. Holds shared identity ("user", role_type) plus per-API tables
-- (grant/grant_type/expert_grant_role, work/work_type/expert_work_role).
--
-- Conventions:
--   - All object references are schema-qualified (api.<table>). No
--     SET search_path; safer when running alongside other schema scripts.
--   - All seed INSERTs use ON CONFLICT (...) DO NOTHING so this file is
--     idempotent and safe to re-run when adding new lookup terms.
--   - Tables are fully defined in their CREATE TABLE statement — no ALTER
--     TABLE blocks. Use the year_week column for ETL-batch traceability.
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS api;

-- ============================================================================
-- Expert identity
-- ============================================================================
CREATE TABLE IF NOT EXISTS api."user" (
  email              VARCHAR(255) PRIMARY KEY,
  expert_id          VARCHAR(16) UNIQUE,
  is_public          BOOLEAN DEFAULT FALSE,
  cdl_privacy        JSONB,
  odr_privacy        JSONB,
  ucd_person_uuid    TEXT UNIQUE,
  iam_id             TEXT UNIQUE,
  display_name       TEXT,
  -- sitefarm profile fields (loaded from ae-std/person.jsonld)
  orcid_id           TEXT,
  researcher_id      TEXT,
  scopus_ids         TEXT[],
  overview           TEXT,
  research_interests TEXT,
  contact_info       JSONB,
  expert_raw_payload JSONB,
  -- ETL batch traceability — which weekly run last upserted this row
  year_week          VARCHAR(10)
);

-- ============================================================================
-- Shared role lookup (grants + works share this)
-- ============================================================================
CREATE TABLE IF NOT EXISTS api.role_type (
  role_type_id SERIAL PRIMARY KEY,
  uri          TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL
);
INSERT INTO api.role_type (uri, label) VALUES
  -- Grant roles
  ('http://vivoweb.org/ontology/core#PrincipalInvestigatorRole',   'PrincipalInvestigatorRole'),
  ('http://vivoweb.org/ontology/core#CoPrincipalInvestigatorRole', 'CoPrincipalInvestigatorRole'),
  ('http://vivoweb.org/ontology/core#ResearcherRole',              'ResearcherRole'),
  ('http://vivoweb.org/ontology/core#LeaderRole',                  'LeaderRole'),
  ('http://schema.library.ucdavis.edu/schema#GrantRole',           'GrantRole'),
  -- Work roles
  ('http://vivoweb.org/ontology/core#Authorship',                  'Authorship'),
  ('http://vivoweb.org/ontology/core#Editorship',                  'Editorship'),
  ('http://schema.library.ucdavis.edu/schema#WorkRole',            'WorkRole')
ON CONFLICT (uri) DO NOTHING;

-- ============================================================================
-- MIV projection: grants
-- ============================================================================
CREATE TABLE IF NOT EXISTS api."grant" (
  grant_id           TEXT PRIMARY KEY,
  title              TEXT,
  sponsor_id         TEXT,
  sponsor_name       TEXT,
  total_award_amount NUMERIC,
  start_date         DATE,
  end_date           DATE,
  status             TEXT,
  raw_payload        JSONB,
  grant_type_ids     INTEGER[] NOT NULL DEFAULT '{}',
  year_week          VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS api.grant_type (
  grant_type_id SERIAL PRIMARY KEY,
  uri           TEXT NOT NULL UNIQUE,
  label         TEXT NOT NULL
);
INSERT INTO api.grant_type (uri, label) VALUES
  ('http://vivoweb.org/ontology/core#Grant',                         'Grant'),
  ('http://schema.library.ucdavis.edu/schema#Grant_AcademicSupport', 'Grant_AcademicSupport'),
  ('http://schema.library.ucdavis.edu/schema#Grant_Default',         'Grant_Default'),
  ('http://schema.library.ucdavis.edu/schema#Grant_Instruction',     'Grant_Instruction'),
  ('http://schema.library.ucdavis.edu/schema#Grant_Research',        'Grant_Research'),
  ('http://schema.library.ucdavis.edu/schema#Grant_Service',         'Grant_Service'),
  ('http://schema.library.ucdavis.edu/schema#Grant_Scholarship',     'Grant_Scholarship'),
  ('http://schema.library.ucdavis.edu/schema#Grant_StudentService',  'Grant_StudentService')
ON CONFLICT (uri) DO NOTHING;

CREATE TABLE IF NOT EXISTS api.expert_grant_role (
  role_id      TEXT PRIMARY KEY,
  grant_id     TEXT NOT NULL REFERENCES api."grant"(grant_id) ON DELETE CASCADE,
  expert_id    VARCHAR(16) REFERENCES api."user"(expert_id) ON DELETE SET NULL,
  role_type_id INTEGER NOT NULL REFERENCES api.role_type(role_type_id),
  is_visible   BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes — only the ones actual queries use. See harvest/lib/api/miv.js
-- and webapp/models/miv/model.js (fetchMivPostgresGrants) for the patterns.
--   start_date / end_date  → MIV date range filter
--   grant_id               → MIV roles-by-grant query
--   expert_id              → MIV grants-by-expert query
-- Skipped: role_type_id (queries join role_type by its PK, never filter by FK).
CREATE INDEX IF NOT EXISTS idx_grant_start_date            ON api."grant"(start_date);
CREATE INDEX IF NOT EXISTS idx_grant_end_date              ON api."grant"(end_date);
CREATE INDEX IF NOT EXISTS idx_expert_grant_role_grant_id  ON api.expert_grant_role(grant_id);
CREATE INDEX IF NOT EXISTS idx_expert_grant_role_expert_id ON api.expert_grant_role(expert_id);

-- ============================================================================
-- SiteFarm projection: works
-- ============================================================================
CREATE TABLE IF NOT EXISTS api.work_type (
  work_type_id SERIAL PRIMARY KEY,
  uri          TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL
);
-- Seeded with the schema.org + ucdlib URIs that ae-std works.js actually emits
-- (via SCHEMA_URI_TYPE_MAP in harvest/lib/transform/utils.js). Other CDL work
-- types are filtered out upstream so they never appear here.
INSERT INTO api.work_type (uri, label) VALUES
  ('http://schema.org/Book',                        'Book'),
  ('http://schema.org/Chapter',                     'Chapter'),
  ('http://schema.org/ScholarlyArticle',            'ScholarlyArticle'),
  ('http://schema.library.ucdavis.edu/schema#Work', 'Work')
ON CONFLICT (uri) DO NOTHING;

CREATE TABLE IF NOT EXISTS api."work" (
  work_id         TEXT PRIMARY KEY,
  title           TEXT,
  issued          TEXT,           -- exact value from source ("2023", "2023-04", "2023-04-15")
  issued_date     DATE,           -- normalized for sorting; partial values padded to first-of-period
  container_title TEXT,
  volume          TEXT,
  page            TEXT,
  doi             TEXT,
  abstract        TEXT,
  status          TEXT,
  raw_payload     JSONB,          -- full ae-std work node, used for lossless reconstruction
  work_type_ids   INTEGER[] NOT NULL DEFAULT '{}',
  year_week       VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS api.expert_work_role (
  role_id      TEXT PRIMARY KEY,
  work_id      TEXT NOT NULL REFERENCES api."work"(work_id) ON DELETE CASCADE,
  expert_id    VARCHAR(16) REFERENCES api."user"(expert_id) ON DELETE SET NULL,
  role_type_id INTEGER REFERENCES api.role_type(role_type_id),
  is_visible   BOOLEAN NOT NULL DEFAULT FALSE,
  is_favourite BOOLEAN NOT NULL DEFAULT FALSE,
  author_rank  INTEGER,           -- expert's position in the author list; NULL if not an author
  raw_payload  JSONB              -- full relatedBy node to faithfully rebuild API responses
);

-- Indexes — only the ones actual queries use. See
-- webapp/models/sitefarm/model.js (fetchSitefarmPostgresExperts) for the
-- patterns.
--   issued_date              → sitefarm ORDER BY in the windowed top-5 CTE
--   work_id                  → sitefarm roles-by-work query
--   (expert_id, is_visible)  → sitefarm works-by-expert filter
-- The composite (expert_id, is_visible) also covers single-column expert_id
-- lookups, so no separate idx_expert_work_role_expert_id is needed.
-- Skipped: role_type_id (queries join role_type by its PK, never filter by FK).
CREATE INDEX IF NOT EXISTS idx_work_issued_date         ON api."work"(issued_date);
CREATE INDEX IF NOT EXISTS idx_expert_work_role_work_id ON api.expert_work_role(work_id);
CREATE INDEX IF NOT EXISTS idx_expert_work_role_expert_visible
  ON api.expert_work_role(expert_id, is_visible);
