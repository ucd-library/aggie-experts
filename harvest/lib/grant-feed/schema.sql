-- ============================================================================
-- grant_feed schema
-- ----------------------------------------------------------------------------
-- Reporting projection of the weekly Aggie Enterprise -> Symplectic grant feed.
-- Tables for the metadata / links / delete_user_grants_links CSVs plus a role
-- lookup, and a per-user weekly stats view. (The grants_persons CSV is still
-- delivered to Symplectic but is not needed for reporting, so it is not stored
-- here.)
--
-- Notes on the data model:
--   - A user can hold >1 role on a grant (e.g. PI + Project Manager), so link
--     rows are keyed by (grant_id, user_id, role_id), not just (grant_id,
--     user_id).
--   - Each table that participates in weekly stats carries year_week and
--     includes it in the PK, so re-running the ETL in the same week upserts
--     the same rows (no double counting) while distinct weeks accumulate as
--     history.
--   - metadata is one row per (grant_id, funding_source, year_week). A grant
--     with multiple funding sources produces one CSV row per funder ("funder
--     name"), and each is kept as its own row here (funding_source is promoted
--     to a column + PK member so they do not collapse).
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
-- metadata — one row per (grant, funding source) per weekly delta
-- (from grants_metadata.csv).
--   funding_source : the "funder name" value; its own column + PK member so a
--                    grant with multiple funders keeps a row per funder rather
--                    than collapsing. '' when the grant has no funder row.
--   change_type    : 'new' if the grant was absent from last week's full
--                    generation, else 'updated'. Grant-level, so all of a
--                    grant's funding_source rows share it.
--   data           : the remaining non-id CSV columns (category, type, title,
--                    c-pi, funder-reference, dates, amount, funding-type,
--                    sponsor, flow-thru, visible) as JSONB. "funder name" is
--                    promoted to funding_source and not duplicated here.
--   date_uploaded  : timestamp the delta was uploaded to Symplectic, or NULL if
--                    the ETL produced the delta but did not upload (--no-upload).
-- ============================================================================
CREATE TABLE IF NOT EXISTS grant_feed.metadata (
  grant_id       TEXT        NOT NULL,
  funding_source TEXT        NOT NULL DEFAULT '',
  change_type    TEXT        NOT NULL CHECK (change_type IN ('new', 'updated')),
  data           JSONB       NOT NULL,
  year_week      VARCHAR(10) NOT NULL,
  date_uploaded  TIMESTAMP,
  PRIMARY KEY (grant_id, funding_source, year_week)
);
CREATE INDEX IF NOT EXISTS idx_grant_feed_metadata_year_week
  ON grant_feed.metadata (year_week);

-- ============================================================================
-- links — user<->grant role links added/updated in a weekly delta
-- (from grants_links.csv). All columns form the PK — it is a pure edge table.
-- (No `visible` column: the feed hardcodes visible=TRUE for every link, so it
-- carried no information.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grant_feed.links (
  grant_id  TEXT        NOT NULL,
  user_id   TEXT        NOT NULL,
  role_id   INTEGER     NOT NULL REFERENCES grant_feed.roles(role_id),
  year_week VARCHAR(10) NOT NULL,
  PRIMARY KEY (grant_id, user_id, role_id, year_week)
);
CREATE INDEX IF NOT EXISTS idx_grant_feed_links_week_user
  ON grant_feed.links (year_week, user_id);
CREATE INDEX IF NOT EXISTS idx_grant_feed_links_grant
  ON grant_feed.links (grant_id);

-- ============================================================================
-- delete_links — user<->grant links removed in a weekly delta
-- (from delete_user_grants_links.csv).
--   date_delete_requested : when the delete was recorded/requested.
-- ============================================================================
CREATE TABLE IF NOT EXISTS grant_feed.delete_links (
  grant_id              TEXT        NOT NULL,
  user_id               TEXT        NOT NULL,
  role_id               INTEGER     NOT NULL REFERENCES grant_feed.roles(role_id),
  year_week             VARCHAR(10) NOT NULL,
  date_delete_requested TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (grant_id, user_id, role_id, year_week)
);
CREATE INDEX IF NOT EXISTS idx_grant_feed_delete_links_week_user
  ON grant_feed.delete_links (year_week, user_id);
CREATE INDEX IF NOT EXISTS idx_grant_feed_delete_links_grant
  ON grant_feed.delete_links (grant_id);

-- ============================================================================
-- weekly_user_grant_feed_stats — per user, per week: how many grants were
-- uploaded (split new vs modified) and how many links were removed.
--
-- Uploads are grants that changed that week (metadata) attributed to a user via
-- their link that week (metadata JOIN links on grant_id + year_week), split by
-- change_type ('new' = absent from last week's full generation, 'updated' =
-- present but changed). Grants with no user link, and links whose grant was not
-- in the metadata delta (rare — a grant filtered out of metadata), do not
-- contribute.
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
    COUNT(DISTINCT m.grant_id) FILTER (WHERE m.change_type = 'new')     AS new_grant_uploads,
    COUNT(DISTINCT m.grant_id) FILTER (WHERE m.change_type = 'updated') AS modified_grant_uploads
  FROM grant_feed.metadata m
  JOIN grant_feed.links l
    ON l.grant_id = m.grant_id AND l.year_week = m.year_week
  GROUP BY l.user_id, m.year_week
),
removals AS (
  SELECT
    user_id AS cdl_user_id,
    year_week,
    COUNT(DISTINCT grant_id) AS grant_deletions
  FROM grant_feed.delete_links
  GROUP BY user_id, year_week
)
SELECT
  COALESCE(u.cdl_user_id, r.cdl_user_id)   AS cdl_user_id,
  COALESCE(u.year_week, r.year_week)       AS year_week,
  COALESCE(u.new_grant_uploads, 0)         AS new_grant_uploads,
  COALESCE(u.modified_grant_uploads, 0)    AS modified_grant_uploads,
  COALESCE(r.grant_deletions, 0)           AS grant_deletions
FROM uploads u
FULL OUTER JOIN removals r
  ON u.cdl_user_id = r.cdl_user_id AND u.year_week = r.year_week;
