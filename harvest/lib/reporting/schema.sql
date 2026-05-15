create schema if not exists etl_reporting;
-- Set the search path to the etl_reporting schema
set search_path = 'etl_reporting';

CREATE TABLE IF NOT EXISTS config (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS elastic_search_index (
  alias_name VARCHAR(255) PRIMARY KEY,
  index_name VARCHAR(255),
  doc_count INTEGER,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO elastic_search_index (alias_name) VALUES ('experts-stage'), ('works-stage'), ('grants-stage'), ('experts-current'), ('works-current'), ('grants-current')
ON CONFLICT (alias_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS command (
  command_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  week_start DATE,
  year_week VARCHAR(10) NOT NULL,
  job_id VARCHAR(255),
  command VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  latest_weekly_attempt BOOLEAN DEFAULT FALSE,
  options JSONB
);
CREATE INDEX IF NOT EXISTS idx_command_week_year ON command (year_week, user_id);
CREATE INDEX IF NOT EXISTS idx_command_command ON command (command, user_id);
CREATE INDEX IF NOT EXISTS idx_command_year_week_latest ON command (user_id, command, year_week, latest_weekly_attempt);
CREATE INDEX IF NOT EXISTS idx_command_latest_weekly_attempt ON command (latest_weekly_attempt);

CREATE TABLE IF NOT EXISTS error (
  error_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  command_id UUID NOT NULL REFERENCES command(command_id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  stack TEXT
);
CREATE INDEX IF NOT EXISTS idx_error_command_id ON error (command_id);

CREATE TABLE IF NOT EXISTS user_scholarly_output_load_stats (
  user_load_stats_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  command_id UUID NOT NULL REFERENCES command(command_id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('works', 'grants')),
  visibility VARCHAR(20) NOT NULL CHECK (visibility IN ('public', 'private')),
  count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_user_scholarly_output_load_stats_command_id ON user_scholarly_output_load_stats (command_id);
CREATE INDEX IF NOT EXISTS idx_user_scholarly_output_load_stats_user_id ON user_scholarly_output_load_stats (user_id);
CREATE INDEX IF NOT EXISTS idx_user_scholarly_output_load_stats_type ON user_scholarly_output_load_stats (type);
CREATE INDEX IF NOT EXISTS idx_user_scholarly_output_load_stats_visibility ON user_scholarly_output_load_stats (visibility);

CREATE TABLE IF NOT EXISTS validation_issue (
  issue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  command_id UUID NOT NULL REFERENCES command(command_id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('work','grant','expert')),
  entity_id TEXT NOT NULL,
  issue_type VARCHAR(50) NOT NULL,
  field VARCHAR(100),
  message TEXT
);

CREATE INDEX IF NOT EXISTS idx_validation_issue_command_id ON validation_issue (command_id);
CREATE INDEX IF NOT EXISTS idx_validation_issue_user_id ON validation_issue (user_id);
CREATE INDEX IF NOT EXISTS idx_validation_issue_entity ON validation_issue (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_validation_issue_issue_type ON validation_issue (issue_type);

CREATE TABLE IF NOT EXISTS "user" (
  email VARCHAR(255) PRIMARY KEY,
  expert_id VARCHAR(16) UNIQUE,
  first_seen_cdl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_cdl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_iam TIMESTAMP,
  is_public BOOLEAN DEFAULT FALSE,
  cdl_privacy JSONB,
  odr_privacy JSONB,
  es_stage_inserted_at TIMESTAMP,
  first_es_insert TIMESTAMP DEFAULT NULL,
  ucd_person_uuid TEXT UNIQUE,
  iam_id TEXT UNIQUE,
  display_name TEXT
);

CREATE OR REPLACE FUNCTION set_user_first_es_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.first_es_insert IS NULL
    AND NEW.es_stage_inserted_at IS NOT NULL THEN
    NEW.first_es_insert := NEW.es_stage_inserted_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_set_user_first_es_insert
BEFORE UPDATE ON "user"
FOR EACH ROW
EXECUTE FUNCTION set_user_first_es_insert();

CREATE TABLE IF NOT EXISTS year_week (
  year_week VARCHAR(10) PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL
);

CREATE OR REPLACE FUNCTION insert_command(
  p_year_week VARCHAR(10),
  p_week_start DATE,
  p_job_id VARCHAR(255),
  p_command VARCHAR(255),
  p_user_id VARCHAR(255),
  p_options JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_command_id UUID;
BEGIN
  -- Set existing records for this user_id, year_week, and command to latest_weekly_attempt = false
  UPDATE etl_reporting.command
  SET latest_weekly_attempt = FALSE
  WHERE year_week = p_year_week
    AND command = p_command
    AND user_id = p_user_id
    AND latest_weekly_attempt = TRUE;

  -- Insert new command with latest_weekly_attempt = true
  INSERT INTO etl_reporting.command (year_week, week_start, job_id, command, user_id, latest_weekly_attempt, options)
  VALUES (p_year_week, p_week_start, p_job_id, p_command, p_user_id, TRUE, p_options)
  RETURNING command_id INTO new_command_id;

  RETURN new_command_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW command_error AS
SELECT
  c.command_id,
  c.timestamp AS command_timestamp,
  c.year_week,
  c.job_id,
  CONCAT(
    '<a href="/dagster/runs/', c.job_id, '" target="_blank">',
    c.job_id,
    '</a>'
  ) as job_link,
  c.command,
  c.user_id,
  c.options,
  c.latest_weekly_attempt,
  e.error_id,
  e.timestamp AS error_timestamp,
  e.message,
  e.stack
FROM
  command c
JOIN  error e ON c.command_id = e.command_id;


CREATE OR REPLACE VIEW user_command_weekly_stats AS
  WITH all_users as (
    SELECT email as user_id
    FROM "user"
  ),
  user_command_stats AS (
    SELECT
      c.user_id,
      c.year_week,
      c.command,
      c.week_start as week_start,
      c.command_id as command_id,
      e.error_id as error_id
    FROM
      all_users all_u
    LEFT JOIN
      command c ON all_u.user_id = c.user_id 
    LEFT JOIN
      error e ON c.command_id = e.command_id
    WHERE 
      c.latest_weekly_attempt = TRUE
  )
  SELECT
    ucs.user_id,
    ucs.command,
    ucs.year_week,
    ucs.week_start,
    CASE
      WHEN ucs.error_id is NOT NULL THEN 'error'
      WHEN ucs.command_id IS NULL THEN 'no_attempt'
      ELSE 'ok'
    END AS state
  FROM user_command_stats ucs;

CREATE OR REPLACE FUNCTION etl_reporting.get_year_week(p_date DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::DATE)
RETURNS TABLE(
  year_week TEXT,
  week_start DATE,
  week_end DATE,
  date DATE
)
LANGUAGE sql
IMMUTABLE AS $$
SELECT
  *, p_date as date
FROM year_week
WHERE p_date >= week_start AND p_date <= week_end;
$$;

CREATE OR REPLACE VIEW this_week_user_state_count AS
WITH state AS (
  SELECT
    user_id,
    year_week,
    CASE
      WHEN BOOL_OR(state = 'error') THEN 'error'
      WHEN BOOL_AND(state = 'ok') THEN 'ok'
      WHEN BOOL_AND(state = 'no_attempt') THEN 'no_attempt'
      ELSE 'unknown'
    END AS state
  FROM user_command_weekly_stats
  WHERE year_week = (SELECT year_week FROM get_year_week())
  GROUP BY user_id, year_week
)
SELECT
  state.*,
  CASE
    WHEN u.es_stage_inserted_at IS NULL THEN 'removed'
    WHEN (SELECT year_week FROM get_year_week()) = (SELECT year_week FROM get_year_week(u.es_stage_inserted_at::DATE)) THEN 'inserted'
    ELSE 'not_inserted'
  END AS es_stage_status
FROM state
LEFT JOIN "user" u ON state.user_id = u.email;

SELECT
  user_id,
  year_week,
  ARRAY_AGG(state) AS states
FROM user_command_weekly_stats
WHERE year_week = (SELECT year_week FROM get_year_week())
GROUP BY user_id, year_week;

CREATE OR REPLACE VIEW user_command_weekly_state_changes AS
  WITH state AS (
    SELECT
      ucs.user_id,
      ucs.command,
      ucs.year_week,
      ucs.state,
      (SELECT ucs2.state FROM user_command_weekly_stats ucs2
       WHERE ucs2.user_id = ucs.user_id
         AND ucs2.command = ucs.command
         AND ucs2.week_start = ucs.week_start - INTERVAL '7 days'
      ) AS prior_week_state
      FROM user_command_weekly_stats ucs
  )
  SELECT
    user_id,
    command,
    year_week,
    state,
    CASE
      WHEN prior_week_state IS DISTINCT FROM state
        THEN
          'change:' ||
          COALESCE(prior_week_state, 'null') ||
          '-' ||
          COALESCE(state, 'null')
      ELSE
        'no-change'
    END AS state_change
  FROM state;

CREATE OR REPLACE VIEW this_week_user_state_changes AS
SELECT
  user_id,
  ARRAY_AGG(REGEXP_REPLACE(command, '^experts-harvest-', '')) AS commands,
  year_week,
  state,
  state_change
FROM user_command_weekly_state_changes
WHERE year_week = (SELECT year_week FROM get_year_week())
GROUP BY
  user_id, year_week, state, state_change;

CREATE OR REPLACE FUNCTION cleanup_old_commands()
RETURNS TABLE(
  deleted_file_cache_count INTEGER,
  deleted_error_count INTEGER,
  deleted_command_count INTEGER
) AS $$
DECLARE
  file_cache_deleted INTEGER;
  error_deleted INTEGER;
  command_deleted INTEGER;
BEGIN
  -- Delete file_cache records older than 3 months
  DELETE FROM file_cache 
  WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '3 months';
  GET DIAGNOSTICS file_cache_deleted = ROW_COUNT;

  -- Delete error records older than 3 months
  DELETE FROM error 
  WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '3 months';
  GET DIAGNOSTICS error_deleted = ROW_COUNT;

  -- Delete commands that have no associated file_cache or error records
  DELETE FROM command 
  WHERE command_id NOT IN (
    SELECT DISTINCT command_id FROM file_cache
    UNION
    SELECT DISTINCT command_id FROM error
  );
  GET DIAGNOSTICS command_deleted = ROW_COUNT;

  -- Return the counts
  RETURN QUERY SELECT file_cache_deleted, error_deleted, command_deleted;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW user_scholarly_output_weekly_changes AS
  WITH weekly_counts AS (
    SELECT
      s.user_id,
      c.year_week,
      c.week_start,
      s.type,
      s.visibility,
      SUM(s.count) AS total_count
    FROM user_scholarly_output_load_stats s
    LEFT JOIN command c ON s.command_id = c.command_id
    WHERE c.latest_weekly_attempt = TRUE
    GROUP BY s.user_id, c.year_week, c.week_start, s.type, s.visibility
  )
  SELECT
    wc.user_id,
    wc.year_week,
    wc.type,
    wc.visibility,
    COALESCE(wc.total_count, 0) - COALESCE(wc_prev.total_count, 0) AS change
  FROM weekly_counts wc
  LEFT JOIN weekly_counts wc_prev ON
    wc.user_id = wc_prev.user_id AND
    wc.type = wc_prev.type AND
    wc.visibility = wc_prev.visibility AND
    wc.week_start = wc_prev.week_start + INTERVAL '7 days';

CREATE OR REPLACE VIEW this_week_user_scholarly_output_changes AS
SELECT
  user_id,
  type,
  visibility,
  change
FROM user_scholarly_output_weekly_changes
WHERE year_week = (SELECT year_week FROM get_year_week());

CREATE OR REPLACE VIEW user_left_this_week AS
WITH last_year_week AS (
  SELECT year_week FROM get_year_week((NOW() - INTERVAL '7 days')::DATE)
)
SELECT
  u.email AS user_id,
  u.last_seen_cdl,
  u.last_seen_iam
FROM "user" u
WHERE 
  (select year_week from last_year_week) = (SELECT year_week FROM get_year_week(u.last_seen_cdl::DATE)) OR
  (SELECT year_week FROM last_year_week) = (SELECT year_week FROM get_year_week(u.last_seen_iam::DATE));

CREATE OR REPLACE VIEW this_week_harvest_errors AS
SELECT
  c.user_id,
  c.command,
  (c.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Los_Angeles') AS timestamp
FROM command c
JOIN error e ON c.command_id = e.command_id
WHERE c.latest_weekly_attempt = TRUE
  AND c.year_week = (SELECT year_week FROM get_year_week());

CREATE OR REPLACE FUNCTION cleanup_old_commands(p_weeks_to_keep INTEGER DEFAULT 8) 
RETURNS INTEGER AS $$
DECLARE
  cutoff_date DATE := CURRENT_DATE - (p_weeks_to_keep * INTERVAL '7 days');
  deleted_command_count INTEGER;
BEGIN
  DELETE FROM etl_reporting.command
  WHERE timestamp::DATE < cutoff_date;
  GET DIAGNOSTICS deleted_command_count = ROW_COUNT;
  RETURN deleted_command_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_users(p_weeks_to_keep INTEGER DEFAULT 24) 
RETURNS INTEGER AS $$
DECLARE
  cutoff_date DATE := CURRENT_DATE - (p_weeks_to_keep * INTERVAL '7 days');
  deleted_user_count INTEGER;
BEGIN
  DELETE FROM etl_reporting."user"
  WHERE last_seen_cdl < cutoff_date;
  GET DIAGNOSTICS deleted_user_count = ROW_COUNT;
  RETURN deleted_user_count;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS "grant" (
  grant_id text primary key,
  title text,
  sponsor_id text,
  sponsor_name text,
  total_award_amount numeric,
  start_date date,
  end_date date,
  status text,
  raw_payload jsonb,
  grant_type_ids INTEGER[] not null default '{}',
  last_seen_cdl timestamptz not null default current_timestamp
);
-- TODO do we need year-week for grants?

CREATE TABLE IF NOT EXISTS role_type (
  role_type_id SERIAL PRIMARY KEY,
  uri TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);
INSERT INTO role_type (uri, label) VALUES
  ('http://vivoweb.org/ontology/core#PrincipalInvestigatorRole',   'PrincipalInvestigatorRole'),
  ('http://vivoweb.org/ontology/core#CoPrincipalInvestigatorRole', 'CoPrincipalInvestigatorRole'),
  ('http://vivoweb.org/ontology/core#ResearcherRole',              'ResearcherRole'),
  ('http://vivoweb.org/ontology/core#LeaderRole',                  'LeaderRole'),
  ('http://schema.library.ucdavis.edu/schema#GrantRole',           'GrantRole')
ON CONFLICT (uri) DO NOTHING;

CREATE TABLE IF NOT EXISTS grant_type (
  grant_type_id SERIAL PRIMARY KEY,
  uri TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);
INSERT INTO grant_type (uri, label) VALUES
  ('http://vivoweb.org/ontology/core#Grant',                         'Grant'),
  ('http://schema.library.ucdavis.edu/schema#Grant_AcademicSupport', 'Grant_AcademicSupport'),
  ('http://schema.library.ucdavis.edu/schema#Grant_Default',         'Grant_Default'),
  ('http://schema.library.ucdavis.edu/schema#Grant_Instruction',     'Grant_Instruction'),
  ('http://schema.library.ucdavis.edu/schema#Grant_Research',        'Grant_Research'),
  ('http://schema.library.ucdavis.edu/schema#Grant_Service',         'Grant_Service'),
  ('http://schema.library.ucdavis.edu/schema#Grant_Scholarship',     'Grant_Scholarship'),
  ('http://schema.library.ucdavis.edu/schema#Grant_StudentService',  'Grant_StudentService')
ON CONFLICT (uri) DO NOTHING;

CREATE TABLE IF NOT EXISTS expert_grant_role (
  role_id text primary key,
  grant_id text not null references "grant"(grant_id) on delete cascade,
  expert_id VARCHAR(16) references "user"(expert_id) on delete set null,
  role_type_id INTEGER not null references role_type(role_type_id),
  is_visible boolean not null default false,
  last_seen_cdl timestamptz not null default current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_grant_start_date ON "grant"(start_date);
CREATE INDEX IF NOT EXISTS idx_grant_end_date ON "grant"(end_date);
CREATE INDEX IF NOT EXISTS idx_expert_grant_role_grant_id ON expert_grant_role(grant_id);
CREATE INDEX IF NOT EXISTS idx_expert_grant_role_expert_id ON expert_grant_role(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_grant_role_type ON expert_grant_role(role_type_id);

-- ============================================================================
-- Sitefarm projection: works + expert profile fields
-- ----------------------------------------------------------------------------
-- Extend "user" with expert profile fields needed by the sitefarm API
-- ============================================================================
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS orcid_id           TEXT,
  ADD COLUMN IF NOT EXISTS researcher_id      TEXT,
  ADD COLUMN IF NOT EXISTS scopus_id          TEXT,
  ADD COLUMN IF NOT EXISTS overview           TEXT,
  ADD COLUMN IF NOT EXISTS research_interests TEXT,
  ADD COLUMN IF NOT EXISTS contact_info       JSONB,
  ADD COLUMN IF NOT EXISTS expert_raw_payload JSONB;

-- Seed role_type with the additional work-related roles. role_type is shared
-- between grants and works so a single lookup serves both.
INSERT INTO role_type (uri, label) VALUES
  ('http://vivoweb.org/ontology/core#Authorship',    'Authorship'),
  ('http://vivoweb.org/ontology/core#Editorship',    'Editorship'),
  ('http://schema.library.ucdavis.edu/schema#WorkRole', 'WorkRole')
ON CONFLICT (uri) DO NOTHING;

CREATE TABLE IF NOT EXISTS work_type (
  work_type_id SERIAL PRIMARY KEY,
  uri          TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL
);

INSERT INTO work_type (uri, label) VALUES
  ('http://purl.org/ontology/bibo/AcademicArticle', 'AcademicArticle'),
  ('http://purl.org/ontology/bibo/Article',         'Article'),
  ('http://purl.org/ontology/bibo/Book',            'Book'),
  ('http://purl.org/ontology/bibo/Chapter',         'Chapter'),
  ('http://purl.org/ontology/bibo/Conference',      'Conference'),
  ('http://purl.org/ontology/bibo/Document',        'Document'),
  ('http://purl.org/ontology/bibo/Manuscript',      'Manuscript'),
  ('http://purl.org/ontology/bibo/Thesis',          'Thesis'),
  ('http://vivoweb.org/ontology/core#ConferencePaper', 'ConferencePaper'),
  ('http://vivoweb.org/ontology/core#Editorship',      'Editorship'),
  ('http://vivoweb.org/ontology/core#Authorship',      'Authorship'),
  ('http://schema.library.ucdavis.edu/schema#Work',    'Work')
ON CONFLICT (uri) DO NOTHING;

CREATE TABLE IF NOT EXISTS "work" (
  work_id         TEXT PRIMARY KEY,
  title           TEXT,
  issued          TEXT,            -- exact value from source ("2023", "2023-04", "2023-04-15")
  issued_date     DATE,            -- normalized for sorting; partial values padded to first-of-period
  container_title TEXT,
  volume          TEXT,
  page            TEXT,
  doi             TEXT,
  abstract        TEXT,
  status          TEXT,
  raw_payload     JSONB,           -- full ae-std work node, used for lossless reconstruction
  work_type_ids   INTEGER[] NOT NULL DEFAULT '{}',
  last_seen_cdl   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expert_work_role (
  role_id       TEXT PRIMARY KEY,
  work_id       TEXT NOT NULL REFERENCES "work"(work_id) ON DELETE CASCADE,
  expert_id     VARCHAR(16) REFERENCES "user"(expert_id) ON DELETE SET NULL,
  role_type_id  INTEGER REFERENCES role_type(role_type_id),
  is_visible    BOOLEAN NOT NULL DEFAULT FALSE,
  is_favourite  BOOLEAN NOT NULL DEFAULT FALSE,
  author_rank   INTEGER,           -- expert's position in the author list; NULL if not an author
  raw_payload   JSONB,             -- full relatedBy node to faithfully rebuild API responses
  last_seen_cdl TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_issued_date ON "work"(issued_date);
CREATE INDEX IF NOT EXISTS idx_expert_work_role_work_id ON expert_work_role(work_id);
CREATE INDEX IF NOT EXISTS idx_expert_work_role_expert_id ON expert_work_role(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_work_role_type ON expert_work_role(role_type_id);
CREATE INDEX IF NOT EXISTS idx_expert_work_role_expert_visible ON expert_work_role(expert_id, is_visible);