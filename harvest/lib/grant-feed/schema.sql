-- ============================================================================
-- grant_feed schema
-- ----------------------------------------------------------------------------
-- Reporting projection of the weekly Aggie Enterprise -> Symplectic grant feed.
-- Tables for the metadata / links / delete_user_grants_links CSVs (what we
-- sent), plus tables for the Symplectic import/delete confirmation parsed from
-- the Elements log files (whether it succeeded), a role lookup, and a per-user
-- weekly stats view. (The grants_persons CSV is delivered to Symplectic but not
-- needed for reporting, so it is not stored here.)
--
-- Notes on the data model:
--   - env ('PROD' | 'QA') is a PK member on every table: either deployment can
--     target either Symplectic instance, so a single DB may hold both, and a
--     week's delta sent to both envs is tracked separately (own date_uploaded
--     and own confirmation).
--   - A user can hold >1 role on a grant (e.g. PI + Project Manager), so link
--     rows are keyed by (grant_id, user_id, role_id).
--   - year_week is a PK member wherever weekly history matters, so re-running
--     the ETL in the same week upserts the same rows (no double counting) while
--     distinct weeks accumulate as history.
--   - metadata is one row per (grant_id, funding_source, year_week, env). A
--     grant with multiple funders keeps a row per funder (funding_source is a
--     column + PK member so they do not collapse).
--   - Symplectic processes our upload ~1 day later, so the import/delete
--     confirmation's year_week is the LOG date's year-week (with a log_date
--     column); it is usually, but not always, the same week as the upload.
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS grant_feed;

-- ============================================================================
-- Role lookup — Symplectic link-type-id -> human-readable role name.
-- Values mirror LINK_ROLE_TO_TYPE_ID in harvest/lib/grant-feed/transform.js.
-- ============================================================================
CREATE TABLE IF NOT EXISTS grant_feed.roles (
  role_id   INTEGER PRIMARY KEY,
  role_name TEXT NOT NULL
);
INSERT INTO grant_feed.roles (role_id, role_name) VALUES
  (118, 'Project Manager'),
  (120, 'Principal Investigator'),
  (121, 'Co-Principal Investigator'),
  (137, 'Project Administrator')
ON CONFLICT (role_id) DO NOTHING;

-- ============================================================================
-- metadata — one row per (grant, funding source, week, env) that we sent.
--   funding_source : the "funder" value; PK member so a grant with multiple
--                    funders keeps a row per funder. '' when no funder row.
--   change_type    : 'new' if the grant was absent from last week's full
--                    generation, else 'updated'. Grant-level.
--   data           : the remaining non-id CSV columns as JSONB ("funder" is
--                    promoted to funding_source and not duplicated here).
--   date_uploaded  : when the delta was uploaded to Symplectic, or NULL if the
--                    ETL produced the delta but did not upload (--no-upload).
-- ============================================================================
CREATE TABLE IF NOT EXISTS grant_feed.metadata (
  grant_id       TEXT        NOT NULL,
  funding_source TEXT        NOT NULL DEFAULT '',
  env            VARCHAR(4)  NOT NULL CHECK (env IN ('PROD', 'QA')),
  change_type    TEXT        NOT NULL CHECK (change_type IN ('new', 'updated')),
  data           JSONB       NOT NULL,
  year_week      VARCHAR(10) NOT NULL,
  date_uploaded  TIMESTAMP,
  PRIMARY KEY (grant_id, funding_source, year_week, env)
);
CREATE INDEX IF NOT EXISTS idx_grant_feed_metadata_week_env
  ON grant_feed.metadata (year_week, env);

-- ============================================================================
-- links — user<->grant role links added/updated in a weekly delta (what we
-- sent). All columns form the PK — a pure edge table. (No `visible` column: the
-- feed hardcodes visible=TRUE for every link, so it carried no information.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grant_feed.links (
  grant_id  TEXT        NOT NULL,
  user_id   TEXT        NOT NULL,
  role_id   INTEGER     NOT NULL REFERENCES grant_feed.roles(role_id),
  env       VARCHAR(4)  NOT NULL CHECK (env IN ('PROD', 'QA')),
  year_week VARCHAR(10) NOT NULL,
  PRIMARY KEY (grant_id, user_id, role_id, year_week, env)
);
CREATE INDEX IF NOT EXISTS idx_grant_feed_links_week_env_user
  ON grant_feed.links (year_week, env, user_id);
CREATE INDEX IF NOT EXISTS idx_grant_feed_links_grant
  ON grant_feed.links (grant_id);

-- ============================================================================
-- delete_links — user<->grant links removed in a weekly delta (what we asked
-- Symplectic to delete), plus the confirmation from the delete-user-links log.
--   date_delete_requested : when the delete was recorded/requested by our ETL.
--   delete_status         : from the Symplectic log — 'deleted' (link removed)
--                           or 'not-found' (link already absent). NULL until a
--                           log confirms it.
--   date_confirmed        : when the delete-user-links log reported the outcome.
-- ============================================================================
CREATE TABLE IF NOT EXISTS grant_feed.delete_links (
  grant_id              TEXT        NOT NULL,
  user_id               TEXT        NOT NULL,
  role_id               INTEGER     NOT NULL REFERENCES grant_feed.roles(role_id),
  env                   VARCHAR(4)  NOT NULL CHECK (env IN ('PROD', 'QA')),
  year_week             VARCHAR(10) NOT NULL,
  date_delete_requested TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  delete_status         TEXT        CHECK (delete_status IN ('deleted', 'not-found')),
  date_confirmed        TIMESTAMP,
  PRIMARY KEY (grant_id, user_id, role_id, year_week, env)
);
CREATE INDEX IF NOT EXISTS idx_grant_feed_delete_links_week_env_user
  ON grant_feed.delete_links (year_week, env, user_id);
CREATE INDEX IF NOT EXISTS idx_grant_feed_delete_links_grant
  ON grant_feed.delete_links (grant_id);

-- ============================================================================
-- import_result — per-grant outcome of the Symplectic grants-feed import,
-- parsed from Import_Successes / Import_Errors. Confirms whether a grant we
-- sent was imported.
--   status     : 'created' | 'updated' | 'failed'
--   error       : failure reason (NULL unless failed)
--   log_date   : the Symplectic import date the outcome came from
-- ============================================================================
CREATE TABLE IF NOT EXISTS grant_feed.import_result (
  grant_id   TEXT        NOT NULL,
  env        VARCHAR(4)  NOT NULL CHECK (env IN ('PROD', 'QA')),
  year_week  VARCHAR(10) NOT NULL,
  status     TEXT        NOT NULL CHECK (status IN ('created', 'updated', 'failed')),
  error      TEXT,
  log_date   DATE        NOT NULL,
  PRIMARY KEY (grant_id, year_week, env)
);
CREATE INDEX IF NOT EXISTS idx_grant_feed_import_result_week_env
  ON grant_feed.import_result (year_week, env);
CREATE INDEX IF NOT EXISTS idx_grant_feed_import_result_status
  ON grant_feed.import_result (status);

-- ============================================================================
-- import_summary — one row per Symplectic import run (per env, per log date):
-- the grants-feed headline stats and the delete-user-links counts.
-- ============================================================================
CREATE TABLE IF NOT EXISTS grant_feed.import_summary (
  env              VARCHAR(4)  NOT NULL CHECK (env IN ('PROD', 'QA')),
  log_date         DATE        NOT NULL,
  year_week        VARCHAR(10) NOT NULL,
  grants_processed INTEGER,
  grants_created   INTEGER,
  grants_updated   INTEGER,
  grants_failed    INTEGER,
  links_deleted    INTEGER,
  links_not_found  INTEGER,
  PRIMARY KEY (env, log_date)
);
CREATE INDEX IF NOT EXISTS idx_grant_feed_import_summary_week_env
  ON grant_feed.import_summary (year_week, env);

-- ============================================================================
-- weekly_user_grant_feed_stats — per user, per week, per env: how many grants
-- were uploaded (split new vs modified) and how many links were removed.
--
-- Uploads are grants that changed that week (metadata) attributed to a user via
-- their link that week (metadata JOIN links on grant_id + year_week + env),
-- split by change_type. Grants with no user link, and links whose grant was not
-- in the metadata delta (rare), do not contribute.
--
-- COUNT(DISTINCT grant_id) collapses a grant's multiple funding-source metadata
-- rows and a user's multiple roles to one grant, and guards against double
-- counting; combined with the year_week PKs, re-running the ETL in a week does
-- not inflate the counts.
-- ============================================================================
CREATE OR REPLACE VIEW grant_feed.weekly_user_grant_feed_stats AS
WITH uploads AS (
  SELECT
    l.user_id AS cdl_user_id,
    m.year_week,
    m.env,
    COUNT(DISTINCT m.grant_id) FILTER (WHERE m.change_type = 'new')     AS new_grant_uploads,
    COUNT(DISTINCT m.grant_id) FILTER (WHERE m.change_type = 'updated') AS modified_grant_uploads
  FROM grant_feed.metadata m
  JOIN grant_feed.links l
    ON l.grant_id = m.grant_id AND l.year_week = m.year_week AND l.env = m.env
  GROUP BY l.user_id, m.year_week, m.env
),
removals AS (
  SELECT
    user_id AS cdl_user_id,
    year_week,
    env,
    COUNT(DISTINCT grant_id) AS grant_deletions
  FROM grant_feed.delete_links
  GROUP BY user_id, year_week, env
)
SELECT
  COALESCE(u.cdl_user_id, r.cdl_user_id)   AS cdl_user_id,
  COALESCE(u.year_week, r.year_week)       AS year_week,
  COALESCE(u.env, r.env)                   AS env,
  COALESCE(u.new_grant_uploads, 0)         AS new_grant_uploads,
  COALESCE(u.modified_grant_uploads, 0)    AS modified_grant_uploads,
  COALESCE(r.grant_deletions, 0)           AS grant_deletions
FROM uploads u
FULL OUTER JOIN removals r
  ON u.cdl_user_id = r.cdl_user_id AND u.year_week = r.year_week AND u.env = r.env;
