create schema if not exists etl_reporting;
-- Set the search path to the etl_reporting schema
set search_path = 'etl_reporting';

CREATE TABLE IF NOT EXISTS file_cache (
  file_cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  job_id VARCHAR(255),
  step VARCHAR(100),
  user_id VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  last_modified TIMESTAMP NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  last_file_hash VARCHAR(64),
  no_op BOOLEAN
);