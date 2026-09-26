-- ============================================================================
-- api_reporting schema
-- ----------------------------------------------------------------------------
-- API usage tracking: one row per inbound request to the webapp's /api/*
-- endpoints, recorded by gateway middleware (webapp/lib/proxy/request-log.js)
-- for usage-count dashboards in Superset. Distinct from the etl_reporting
-- schema (harvest/lib/reporting/schema.sql), which tracks ETL job/run
-- observability, not live HTTP traffic.
--
-- Conventions:
--   - All object references are schema-qualified (api_reporting.<table>).
--     No SET search_path; safer when running alongside other schema scripts.
--   - Tables are fully defined in their CREATE TABLE statement — no ALTER
--     TABLE blocks.
--   - Kept intentionally lean: only what's needed to count/filter requests
--     by API root path and time. Query params are never stored (they can
--     carry sensitive values); path_rest is the requested path only.
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS api_reporting;

CREATE TABLE IF NOT EXISTS api_reporting.request_log (
  id          BIGSERIAL PRIMARY KEY,
  -- sub-API name mounted under /api, e.g. expert, search, miv, work, grant,
  -- sitefarm, schema, harvest (see webapp/models/index.js)
  path_root   TEXT NOT NULL,
  -- remainder of the request path after the root segment, e.g. /browse,
  -- /12345/positions; NULL when the request is just /api/<root>
  path_rest   TEXT,
  ip_address  INET,
  status_code SMALLINT,
  latency_ms  INTEGER,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single index on the timestamp, per the lean-tracking requirement — this is
-- the column every dashboard time-range filter will hit.
CREATE INDEX IF NOT EXISTS idx_request_log_occurred_at ON api_reporting.request_log (occurred_at);

-- ============================================================================
-- Cleanup invoked from `experts harvest reporting clean` CLI call and Dagster 
-- cleanup_job.
-- ============================================================================
CREATE OR REPLACE FUNCTION api_reporting.cleanup_old_request_log(p_weeks_to_keep INTEGER DEFAULT 8)
RETURNS INTEGER AS $$
DECLARE
  cutoff_date          DATE := CURRENT_DATE - (p_weeks_to_keep * INTERVAL '7 days');
  deleted_request_count INTEGER;
BEGIN
  DELETE FROM api_reporting.request_log
  WHERE occurred_at::DATE < cutoff_date;
  GET DIAGNOSTICS deleted_request_count = ROW_COUNT;
  RETURN deleted_request_count;
END;
$$ LANGUAGE plpgsql;
