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
  no_op BOOLEAN,
  gcs_write BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_file_cache_command_id ON file_cache (command_id);
CREATE INDEX IF NOT EXISTS idx_file_cache_step ON file_cache (step);
CREATE INDEX IF NOT EXISTS idx_file_cache_timestamp ON file_cache (timestamp);
CREATE INDEX IF NOT EXISTS no_op_idx ON file_cache (no_op);
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
  f.no_op,
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
  no_op,
  gcs_write
FROM (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY file_path ORDER BY file_cache_timestamp DESC) as rn
  FROM command_file_cache
) ranked
WHERE rn = 1;

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