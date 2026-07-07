-- ============================================================================
-- etl_reporting schema
-- ----------------------------------------------------------------------------
-- ETL run observability: commands, errors, validation issues, weekly state
-- views, year-week dimension, ES index registry. Visualized in Superset via
-- the Anduin platform.
--
-- The api schema (grants, works, expert profile — consumed by the webapp
-- endpoints) lives in harvest/lib/api/schema.sql. It owns its own `user`
-- table for identity/profile data. This schema owns a sibling `user` table
-- that holds per-user ETL observability timestamps (first_seen_cdl,
-- last_seen_cdl, last_seen_iam, es_stage_inserted_at, first_es_insert).
-- The two tables are joined by email when reporting views need both.
--
-- Conventions:
--   - All object references are schema-qualified (etl_reporting.<table>).
--     No SET search_path; safer when running alongside other schema scripts.
--   - All seed INSERTs use ON CONFLICT (...) DO NOTHING.
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS etl_reporting;

CREATE TABLE IF NOT EXISTS etl_reporting.config (
  key   VARCHAR(255) PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS etl_reporting.elastic_search_index (
  alias_name   VARCHAR(255) PRIMARY KEY,
  index_name   VARCHAR(255),
  doc_count    INTEGER,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO etl_reporting.elastic_search_index (alias_name) VALUES
  ('experts-stage'), ('works-stage'), ('grants-stage'),
  ('experts-current'), ('works-current'), ('grants-current')
ON CONFLICT (alias_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS etl_reporting.command (
  command_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  week_start            DATE,
  year_week             VARCHAR(10) NOT NULL,
  job_id                VARCHAR(255),
  command               VARCHAR(255) NOT NULL,
  user_id               VARCHAR(255) NOT NULL,
  latest_weekly_attempt BOOLEAN DEFAULT FALSE,
  options               JSONB
);
CREATE INDEX IF NOT EXISTS idx_command_week_year             ON etl_reporting.command (year_week, user_id);
CREATE INDEX IF NOT EXISTS idx_command_command               ON etl_reporting.command (command, user_id);
CREATE INDEX IF NOT EXISTS idx_command_year_week_latest      ON etl_reporting.command (user_id, command, year_week, latest_weekly_attempt);
CREATE INDEX IF NOT EXISTS idx_command_latest_weekly_attempt ON etl_reporting.command (latest_weekly_attempt);

CREATE TABLE IF NOT EXISTS etl_reporting.error (
  error_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  command_id UUID NOT NULL REFERENCES etl_reporting.command(command_id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  stack      TEXT
);
CREATE INDEX IF NOT EXISTS idx_error_command_id ON etl_reporting.error (command_id);

CREATE TABLE IF NOT EXISTS etl_reporting.user_scholarly_output_load_stats (
  user_load_stats_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  command_id         UUID NOT NULL REFERENCES etl_reporting.command(command_id) ON DELETE CASCADE,
  user_id            VARCHAR(255) NOT NULL,
  type               VARCHAR(50) NOT NULL CHECK (type IN ('works', 'grants')),
  visibility         VARCHAR(20) NOT NULL CHECK (visibility IN ('public', 'private')),
  count              INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_user_scholarly_output_load_stats_command_id ON etl_reporting.user_scholarly_output_load_stats (command_id);
CREATE INDEX IF NOT EXISTS idx_user_scholarly_output_load_stats_user_id    ON etl_reporting.user_scholarly_output_load_stats (user_id);
CREATE INDEX IF NOT EXISTS idx_user_scholarly_output_load_stats_type       ON etl_reporting.user_scholarly_output_load_stats (type);
CREATE INDEX IF NOT EXISTS idx_user_scholarly_output_load_stats_visibility ON etl_reporting.user_scholarly_output_load_stats (visibility);

CREATE TABLE IF NOT EXISTS etl_reporting.validation_issue (
  issue_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  command_id  UUID NOT NULL REFERENCES etl_reporting.command(command_id) ON DELETE CASCADE,
  user_id     VARCHAR(255) NOT NULL,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('work','grant','expert')),
  entity_id   TEXT NOT NULL,
  issue_type  VARCHAR(50) NOT NULL,
  field       VARCHAR(100),
  message     TEXT
);
CREATE INDEX IF NOT EXISTS idx_validation_issue_command_id ON etl_reporting.validation_issue (command_id);
CREATE INDEX IF NOT EXISTS idx_validation_issue_user_id    ON etl_reporting.validation_issue (user_id);
CREATE INDEX IF NOT EXISTS idx_validation_issue_entity     ON etl_reporting.validation_issue (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_validation_issue_issue_type ON etl_reporting.validation_issue (issue_type);

CREATE TABLE IF NOT EXISTS etl_reporting.year_week (
  year_week  VARCHAR(10) PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end   DATE NOT NULL
);

-- ============================================================================
-- etl_reporting.user — per-user ETL observability timestamps
-- ----------------------------------------------------------------------------
-- Tracks when each (expert_id, email) moniker was seen in CDL/IAM, when it
-- was inserted into elasticsearch staging, and the first such ES insertion
-- (set by trigger so it sticks across reloads).
--
-- The composite PK (expert_id, email) intentionally allows one row per
-- moniker. Users with dual appointments (e.g. @ucdavis.edu and @berkeley.edu)
-- will have two rows sharing the same expert_id. All downstream views join on
-- email as user_id and operate at the moniker level. If a query is ever added
-- that groups or aggregates by expert_id across emails, beware of fan-out: a
-- user with N monikers will produce N rows here and could be counted multiple
-- times.
--
-- Sister table to api."user", which holds identity/profile data and is keyed
-- by expert_id (one row per person).
-- ============================================================================
CREATE TABLE IF NOT EXISTS etl_reporting."user" (
  expert_id            VARCHAR(16)  NOT NULL,
  email                VARCHAR(255) NOT NULL,
  first_seen_cdl       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_cdl        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_iam        TIMESTAMP,
  es_stage_inserted_at TIMESTAMP,
  first_es_insert      TIMESTAMP DEFAULT NULL,
  PRIMARY KEY (expert_id, email)
);

CREATE OR REPLACE FUNCTION etl_reporting.set_user_first_es_insert()
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
BEFORE UPDATE ON etl_reporting."user"
FOR EACH ROW
EXECUTE FUNCTION etl_reporting.set_user_first_es_insert();

-- ============================================================================
-- Command insertion helper
-- ============================================================================
CREATE OR REPLACE FUNCTION etl_reporting.insert_command(
  p_year_week  VARCHAR(10),
  p_week_start DATE,
  p_job_id     VARCHAR(255),
  p_command    VARCHAR(255),
  p_user_id    VARCHAR(255),
  p_options    JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_command_id UUID;
BEGIN
  -- Mark any existing latest_weekly_attempt rows for this user/command/week as not-latest.
  UPDATE etl_reporting.command
  SET latest_weekly_attempt = FALSE
  WHERE year_week = p_year_week
    AND command = p_command
    AND user_id = p_user_id
    AND latest_weekly_attempt = TRUE;

  -- Insert the new attempt as the latest.
  INSERT INTO etl_reporting.command (year_week, week_start, job_id, command, user_id, latest_weekly_attempt, options)
  VALUES (p_year_week, p_week_start, p_job_id, p_command, p_user_id, TRUE, p_options)
  RETURNING command_id INTO new_command_id;

  RETURN new_command_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Views
-- ============================================================================
CREATE OR REPLACE VIEW etl_reporting.command_error AS
SELECT
  c.command_id,
  c.timestamp AS command_timestamp,
  c.year_week,
  c.job_id,
  CONCAT(
    '<a href="/dagster/runs/', c.job_id, '" target="_blank">',
    c.job_id,
    '</a>'
  ) AS job_link,
  c.command,
  c.user_id,
  c.options,
  c.latest_weekly_attempt,
  e.error_id,
  e.timestamp AS error_timestamp,
  e.message,
  e.stack
FROM etl_reporting.command c
JOIN etl_reporting.error e ON c.command_id = e.command_id;

CREATE OR REPLACE VIEW etl_reporting.user_command_weekly_stats AS
  WITH all_users AS (
    SELECT email AS user_id
    FROM etl_reporting."user"
  ),
  user_command_stats AS (
    SELECT
      c.user_id,
      c.year_week,
      c.command,
      c.week_start AS week_start,
      c.command_id AS command_id,
      e.error_id   AS error_id
    FROM all_users all_u
    LEFT JOIN etl_reporting.command c ON all_u.user_id = c.user_id
    LEFT JOIN etl_reporting.error   e ON c.command_id = e.command_id
    WHERE c.latest_weekly_attempt = TRUE
  )
  SELECT
    ucs.user_id,
    ucs.command,
    ucs.year_week,
    ucs.week_start,
    CASE
      WHEN ucs.error_id IS NOT NULL THEN 'error'
      WHEN ucs.command_id IS NULL   THEN 'no_attempt'
      ELSE 'ok'
    END AS state
  FROM user_command_stats ucs;

CREATE OR REPLACE FUNCTION etl_reporting.get_year_week(p_date DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::DATE)
RETURNS TABLE(
  year_week  TEXT,
  week_start DATE,
  week_end   DATE,
  date       DATE
)
LANGUAGE sql
IMMUTABLE AS $$
SELECT
  *, p_date AS date
FROM etl_reporting.year_week
WHERE p_date >= week_start AND p_date <= week_end;
$$;

CREATE OR REPLACE VIEW etl_reporting.this_week_user_state_count AS
WITH state AS (
  SELECT
    user_id,
    year_week,
    CASE
      WHEN BOOL_OR(state = 'error')      THEN 'error'
      WHEN BOOL_AND(state = 'ok')        THEN 'ok'
      WHEN BOOL_AND(state = 'no_attempt') THEN 'no_attempt'
      ELSE 'unknown'
    END AS state
  FROM etl_reporting.user_command_weekly_stats
  WHERE year_week = (SELECT year_week FROM etl_reporting.get_year_week())
  GROUP BY user_id, year_week
)
SELECT
  state.*,
  CASE
    WHEN u.es_stage_inserted_at IS NULL THEN 'removed'
    WHEN (SELECT year_week FROM etl_reporting.get_year_week()) = (SELECT year_week FROM etl_reporting.get_year_week(u.es_stage_inserted_at::DATE)) THEN 'inserted'
    ELSE 'not_inserted'
  END AS es_stage_status
FROM state
LEFT JOIN etl_reporting."user" u ON state.user_id = u.email;

CREATE OR REPLACE VIEW etl_reporting.user_command_weekly_state_changes AS
  WITH state AS (
    SELECT
      ucs.user_id,
      ucs.command,
      ucs.year_week,
      ucs.state,
      (SELECT ucs2.state FROM etl_reporting.user_command_weekly_stats ucs2
       WHERE ucs2.user_id = ucs.user_id
         AND ucs2.command = ucs.command
         AND ucs2.week_start = ucs.week_start - INTERVAL '7 days'
      ) AS prior_week_state
    FROM etl_reporting.user_command_weekly_stats ucs
  )
  SELECT
    user_id,
    command,
    year_week,
    state,
    CASE
      WHEN prior_week_state IS DISTINCT FROM state
        THEN 'change:' || COALESCE(prior_week_state, 'null') || '-' || COALESCE(state, 'null')
      ELSE 'no-change'
    END AS state_change
  FROM state;

CREATE OR REPLACE VIEW etl_reporting.this_week_user_state_changes AS
SELECT
  user_id,
  ARRAY_AGG(REGEXP_REPLACE(command, '^experts-harvest-', '')) AS commands,
  year_week,
  state,
  state_change
FROM etl_reporting.user_command_weekly_state_changes
WHERE year_week = (SELECT year_week FROM etl_reporting.get_year_week())
GROUP BY user_id, year_week, state, state_change;

CREATE OR REPLACE VIEW etl_reporting.user_scholarly_output_weekly_changes AS
  WITH weekly_counts AS (
    SELECT
      s.user_id,
      c.year_week,
      c.week_start,
      s.type,
      s.visibility,
      SUM(s.count) AS total_count
    FROM etl_reporting.user_scholarly_output_load_stats s
    LEFT JOIN etl_reporting.command c ON s.command_id = c.command_id
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
    wc.user_id   = wc_prev.user_id AND
    wc.type      = wc_prev.type    AND
    wc.visibility = wc_prev.visibility AND
    wc.week_start = wc_prev.week_start + INTERVAL '7 days';

CREATE OR REPLACE VIEW etl_reporting.this_week_user_scholarly_output_changes AS
SELECT
  user_id,
  type,
  visibility,
  change
FROM etl_reporting.user_scholarly_output_weekly_changes
WHERE year_week = (SELECT year_week FROM etl_reporting.get_year_week());

CREATE OR REPLACE VIEW etl_reporting.user_left_this_week AS
WITH last_year_week AS (
  SELECT year_week FROM etl_reporting.get_year_week((NOW() - INTERVAL '7 days')::DATE)
)
SELECT
  u.email AS user_id,
  u.last_seen_cdl,
  u.last_seen_iam
FROM etl_reporting."user" u
WHERE
  (SELECT year_week FROM last_year_week) = (SELECT year_week FROM etl_reporting.get_year_week(u.last_seen_cdl::DATE)) OR
  (SELECT year_week FROM last_year_week) = (SELECT year_week FROM etl_reporting.get_year_week(u.last_seen_iam::DATE));

CREATE OR REPLACE VIEW etl_reporting.this_week_harvest_errors AS
SELECT
  c.user_id,
  c.command,
  (c.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Los_Angeles') AS timestamp
FROM etl_reporting.command c
JOIN etl_reporting.error e ON c.command_id = e.command_id
WHERE c.latest_weekly_attempt = TRUE
  AND c.year_week = (SELECT year_week FROM etl_reporting.get_year_week());

-- ============================================================================
-- Cleanup functions
-- ============================================================================
CREATE OR REPLACE FUNCTION etl_reporting.cleanup_old_commands(p_weeks_to_keep INTEGER DEFAULT 8)
RETURNS INTEGER AS $$
DECLARE
  cutoff_date           DATE := CURRENT_DATE - (p_weeks_to_keep * INTERVAL '7 days');
  deleted_command_count INTEGER;
BEGIN
  DELETE FROM etl_reporting.command
  WHERE timestamp::DATE < cutoff_date;
  GET DIAGNOSTICS deleted_command_count = ROW_COUNT;
  RETURN deleted_command_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION etl_reporting.cleanup_old_users(p_weeks_to_keep INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
  cutoff_date        DATE := CURRENT_DATE - (p_weeks_to_keep * INTERVAL '7 days');
  deleted_user_count INTEGER;
BEGIN
  DELETE FROM etl_reporting."user"
  WHERE last_seen_cdl < cutoff_date;
  GET DIAGNOSTICS deleted_user_count = ROW_COUNT;
  RETURN deleted_user_count;
END;
$$ LANGUAGE plpgsql;
