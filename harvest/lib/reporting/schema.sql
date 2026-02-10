create schema if not exists etl_reporting;
-- Set the search path to the etl_reporting schema
set search_path = 'etl_reporting';

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
  command_id UUID NOT NULL REFERENCES command(command_id),
  message TEXT NOT NULL,
  stack TEXT
);
CREATE INDEX IF NOT EXISTS idx_error_command_id ON error (command_id);

CREATE TABLE IF NOT EXISTS user_scholarly_output_load_stats (
  user_load_stats_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  command_id UUID NOT NULL REFERENCES command(command_id),
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('works', 'grants')),
  visibility VARCHAR(20) NOT NULL CHECK (visibility IN ('public', 'private')),
  count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_user_scholarly_output_load_stats_command_id ON user_scholarly_output_load_stats (command_id);
CREATE INDEX IF NOT EXISTS idx_user_scholarly_output_load_stats_user_id ON user_scholarly_output_load_stats (user_id);
CREATE INDEX IF NOT EXISTS idx_user_scholarly_output_load_stats_type ON user_scholarly_output_load_stats (type);
CREATE INDEX IF NOT EXISTS idx_user_scholarly_output_load_stats_visibility ON user_scholarly_output_load_stats (visibility);

CREATE TABLE IF NOT EXISTS "user" (
  email VARCHAR(255) PRIMARY KEY,
  first_seen_cdl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_cdl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_iam TIMESTAMP
);

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

CREATE OR REPLACE FUNCTION etl_reporting.get_year_week(p_date DATE DEFAULT CURRENT_DATE)
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
GROUP BY user_id, year_week;

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