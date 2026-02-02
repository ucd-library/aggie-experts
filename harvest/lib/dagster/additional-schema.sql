CREATE SCHEMA IF NOT EXISTS ae;

CREATE INDEX IF NOT EXISTS idx_runs_status_backfill
  ON public.runs (status, backfill_id)
  WHERE backfill_id IS NOT NULL;

CREATE OR REPLACE FUNCTION ae.get_active_backfill_ids()
RETURNS TABLE(backfill_id text)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT DISTINCT r.backfill_id
  FROM public.runs r
  WHERE r.status = ANY (ARRAY['QUEUED', 'NOT_STARTED', 'STARTING', 'STARTED', 'CANCELING'])
    AND r.backfill_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION ae.is_active(p_backfill_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.runs r
    WHERE r.backfill_id = p_backfill_id
      AND r.status = ANY (ARRAY['QUEUED', 'NOT_STARTED', 'STARTING', 'STARTED', 'CANCELING'])
  );
$$;