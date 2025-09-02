create schema if not exists etl_reporting;
-- Set the search path to the etl_reporting schema
set search_path = 'etl_reporting';

CREATE TABLE IF NOT EXISTS command (
  command_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  job_id VARCHAR(255),
  command VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  options JSONB
);
CREATE INDEX IF NOT EXISTS idx_command_job_id ON command (job_id);
CREATE INDEX IF NOT EXISTS idx_command_user_id ON command (user_id);

CREATE TABLE IF NOT EXISTS file_cache (
  file_cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  command_id UUID NOT NULL REFERENCES command(command_id),
  step VARCHAR(100),
  file_path TEXT NOT NULL,
  last_modified TIMESTAMP NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  last_file_hash VARCHAR(64),
  local_cache_write BOOLEAN,
  gcs_write BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_file_cache_command_id ON file_cache (command_id);
CREATE INDEX IF NOT EXISTS idx_file_cache_step ON file_cache (step);
CREATE INDEX IF NOT EXISTS idx_file_cache_timestamp ON file_cache (timestamp);
CREATE INDEX IF NOT EXISTS local_cache_write_idx ON file_cache (local_cache_write);
CREATE INDEX IF NOT EXISTS gcs_write_idx ON file_cache (gcs_write);

CREATE OR REPLACE VIEW command_file_cache AS
SELECT
  c.command_id,
  c.timestamp AS command_timestamp,
  c.job_id,
  c.command,
  c.user_id,
  c.options,
  f.file_cache_id,
  f.timestamp AS file_cache_timestamp,
  f.step,
  f.file_path,
  f.last_modified,
  f.file_hash,
  f.last_file_hash,
  f.local_cache_write,
  f.gcs_write
FROM
  command c
JOIN
  file_cache f ON c.command_id = f.command_id;

CREATE OR REPLACE VIEW latest_command_file_cache AS
SELECT
  command_id,
  command_timestamp,
  job_id,
  command,
  user_id,
  options,
  file_cache_id,
  file_cache_timestamp,
  step,
  file_path,
  last_modified,
  file_hash,
  last_file_hash,
  local_cache_write,
  gcs_write
FROM (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY file_path ORDER BY file_cache_timestamp DESC) as rn
  FROM command_file_cache
) ranked
WHERE rn = 1;

CREATE OR REPLACE VIEW user_activity_last_7_days AS
SELECT
  c.user_id,
  BOOL_OR(f.gcs_write = TRUE) AS updated
FROM
  command c
JOIN
  file_cache f ON c.command_id = f.command_id
WHERE
  f.timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY
  c.user_id;

CREATE TABLE IF NOT EXISTS error (
  error_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  command_id UUID NOT NULL REFERENCES command(command_id),
  message TEXT NOT NULL,
  stack TEXT
);
CREATE INDEX IF NOT EXISTS idx_error_command_id ON error (command_id);

CREATE OR REPLACE VIEW command_error AS
SELECT
  c.command_id,
  c.timestamp AS command_timestamp,
  c.job_id,
  c.command,
  c.user_id,
  c.options,
  e.error_id,
  e.timestamp AS error_timestamp,
  e.message,
  e.stack
FROM
  command c
JOIN  error e ON c.command_id = e.command_id;

CREATE OR REPLACE VIEW user_command_weekly_stats AS
  WITH users as (
    SELECT DISTINCT user_id
    FROM command
  ),
  weeks AS (
    SELECT DISTINCT
      EXTRACT('week' FROM timestamp)::TEXT || '-' || EXTRACT('year' FROM timestamp)::TEXT AS week_of_year
    FROM command
  ),
  user_commands as (
    SELECT 
      u.user_id,
      w.week_of_year,
      c.command,
      c.command_id,
      e.error_id
    FROM
      users u
    LEFT JOIN
      weeks w ON TRUE
    LEFT JOIN
      command c ON u.user_id = c.user_id AND (EXTRACT('week' FROM c.timestamp)::TEXT || '-' || EXTRACT('year' FROM c.timestamp)::TEXT) = w.week_of_year
    LEFT JOIN
      error e ON c.command_id = e.command_id
  )
  SELECT 
    uc.user_id,
    uc.command,
    uc.week_of_year,
    COUNT(uc.command_id) AS exec_count,
    COUNT(e.error_id) AS error_count,
      CASE
        WHEN COUNT(e.error_id) > 0 THEN 'error'
        WHEN COUNT(uc.command_id) = 0 THEN 'no_attempt'
        ELSE 'ok' END AS state
  FROM
    user_commands uc
  LEFT JOIN
    error e ON uc.command_id = e.command_id
  GROUP BY
    uc.user_id, uc.command, uc.week_of_year
  ORDER BY
    uc.week_of_year, uc.user_id, uc.command;

CREATE OR REPLACE VIEW user_command_weekly_state_changes AS
  WITH state_with_lag AS (
    SELECT
      user_id,
      command,
      week_of_year,
      state,
      LAG(state) OVER (PARTITION BY user_id ORDER BY week_of_year) AS prev_state
    FROM user_command_weekly_stats
  )
  SELECT
    user_id,
    command,
    week_of_year,
    state,
    CASE
      WHEN prev_state IS DISTINCT FROM state
        THEN
          'change:' ||
          COALESCE(prev_state, 'null') ||
          '-' ||
          COALESCE(state, 'null')
      ELSE
        'no-change'
    END AS state_change
  FROM state_with_lag;

CREATE OR REPLACE VIEW this_week_user_state_changes AS
SELECT
  user_id,
  ARRAY_AGG(REGEXP_REPLACE(command, '^experts-harvest-', '')) AS commands,
  week_of_year,
  state,
  state_change
FROM user_command_weekly_state_changes
WHERE week_of_year = EXTRACT('week' FROM CURRENT_TIMESTAMP)::TEXT || '-' || EXTRACT('year' FROM CURRENT_TIMESTAMP)::TEXT
GROUP BY
  user_id, week_of_year, state, state_change;

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