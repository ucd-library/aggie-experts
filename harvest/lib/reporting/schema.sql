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

CREATE TABLE IF NOT EXISTS file_cache (
  file_cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  command_id UUID NOT NULL REFERENCES command(command_id),
  step VARCHAR(100),
  file_path TEXT NOT NULL,
  last_modified TIMESTAMP NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  last_file_hash VARCHAR(64),
  no_op BOOLEAN
);

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
  f.no_op
FROM
  command c
JOIN
  file_cache f ON c.command_id = f.command_id;

CREATE TABLE IF NOT EXISTS error (
  error_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  command_id UUID NOT NULL REFERENCES command(command_id),
  message TEXT NOT NULL,
  stack TEXT
);

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