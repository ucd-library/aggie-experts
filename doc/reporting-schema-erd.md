# ETL Reporting and Dashboard

The Aggie Experts harvest dashboard in Superset is the primary tool for understanding
what happened during a weekly ETL run and how it compares to prior weeks. It is available
through the Anduin auth gateway at `/superset`.

The underlying data lives in two PostgreSQL schemas defined by
[`harvest/lib/reporting/schema.sql`](../harvest/lib/reporting/schema.sql):

- `etl_reporting` — ETL run observability (commands, errors, weekly state views)
- `api` — API-shaped projection consumed by the webapp MIV and SiteFarm endpoints
  (user identity, grants, works, and their role join tables)

The schema ERD is shown below.

![Reporting Database ERD](./reporting-schema-erd.png)

## Dashboard tabs

The dashboard is organized into seven tabs. After a weekly harvest the typical review
order is: **Overview → ETL Step Results → Errors → Scholarly Output**.

---

### Overview

The weekly health summary. This is the first thing to check after a harvest completes.

| Panel | What it tells you |
|---|---|
| **Harvested to Webapp** | Count of users successfully processed through the full ETL pipeline to Elasticsearch. A healthy week matches the expected expert group size. |
| **Harvest Errors** | Count of users with at least one command failure this week. Should be 0 or near-0. |
| **Left Aggie Experts** | Users present last week but not this week (no longer in the CDL group or IAM). See the **Users Left This Week** table below for names. |
| **Users Set to Private** | Count of users whose profiles are currently flagged as private (not publicly visible in the webapp). |
| **New Experts** | Users appearing in the harvest for the first time this week. |
| **This Week Harvest Errors** | Bar chart of errors by day/command — useful for spotting whether failures are concentrated in a specific step. |
| **Users Left This Week** | Table of departed users with their `last_seen_cdl` and `last_seen_iam` dates. Typical causes are CDL group membership changes or IAM deactivation. |
| **New Users** | Bar chart of newly added users over time. |

The **current week** filter at the top of the page (e.g. `2026-16`, dates `2026-04-18` to
`2026-04-24`) scopes all panels to the active harvest week.

---

### ETL Step Results

Per-user, per-command tracking. Use this tab to understand which users changed state
compared to the previous week and to diagnose individual failures.

The tab header explains the three views:

> **User Command Weekly Stats** — every command run and its result (`ok` or `error`).
> **Weekly User Changes** — the week each command last ran, compared to the prior week.
> **Current Weekly User Changes** — the current week only, showing commands whose
> result changed from the prior week.

| Panel | What it tells you |
|---|---|
| **Current Weekly User Changes** | Users and commands whose state flipped this week (`changed-to-ok`, `changed-to-error`). This is the fastest way to spot regressions or recoveries. |
| **Weekly User Changes** | Full history of per-user command states across weeks. Useful for spotting users with persistent errors or intermittent failures. |
| **User Command Weekly Stats** | All commands for the currently selected user, with per-command `ok`/`error` state. Filter by **User Email** on the left to drill into a specific researcher. |

Commands tracked include `extract`, `transform ae-std`, `transform webapp`, and `load`.
A user showing `changed-to-ok` on `transform-webapp` after an error means their data is
now flowing correctly end-to-end.

---

### Errors

Detailed error log for the current week. Surfaces the actual error messages from failed
commands alongside a link to the corresponding Dagster run for full log access. Use this
after spotting error counts on the Overview tab.

Backed by the `this_week_harvest_errors` view (timestamps localized to Pacific time).

---

### Elastic Search

Index and alias status. Shows which year-week indexes exist and where the `latest` and
`public` aliases are currently pointing. Useful when verifying that a promotion (`set_alias`)
took effect or when investigating why the webapp is serving stale data.

---

### Scholarly Output

Week-over-week changes in publication and grant counts per user. This tab is the most
useful for understanding the *content* impact of a harvest — what research actually
changed, not just whether the pipeline ran.

| Panel | What it tells you |
|---|---|
| **Current Weekly User Scholars Changes** | Users whose work or grant counts changed this week, with the delta highlighted. A researcher with `+1` added a newly harvested publication. Negative deltas warrant investigation. |
| **User Scholarly Output** | Full per-user, per-type (work/grant), per-visibility (public/private) counts for any week. Filter by **Scholarly Output Type** (work or grant) and **Weekly** to narrow the view. |
| **Weekly Change in Scholarly Output** | The numeric delta for each user/type/visibility across weeks. Large unexpected drops (e.g. a user losing 50 works) should be verified against the CDL Elements source. |

---

### Users

Full user registry table. Columns include `first_seen_cdl`, `last_seen_cdl`,
`first_seen_iam`, `last_seen_iam`, `is_public`, `is_uc_path`, and change-tracking
flags. Useful for answering questions like "when did this researcher first appear in
the harvest?" or "why is this user flagged as private?". Supports sorting and filtering
by any column; the table paginates at 200 rows per page.

---

### Validation Issues

Researchers with data quality problems detected during harvest — for example, users
missing the `nameWwwFlag` field required for public display. Surfaces records that
were harvested successfully but may not render correctly in the webapp.

---

## Schema reference

### Tables

**`etl_reporting` (run observability)**

- `etl_reporting.command` — one row per command execution (user, command name, year-week, Dagster run ID, state, note)
- `etl_reporting.error` — error detail rows linked to a command via `command_id`
- `etl_reporting.user_scholarly_output_load_stats` — per-user, per-type, per-visibility document counts written to Elasticsearch each week
- `etl_reporting.validation_issue` — field-level validation problems detected during harvest
- `etl_reporting.elastic_search_index` — index/alias state snapshots
- `etl_reporting.year_week` — week dimension table used for joining across snapshots

**`api` (API projection)**

- `api.user` — user registry with `first_seen_cdl`, `last_seen_cdl`, `last_seen_iam`, public/visibility flags, plus expert profile fields (`orcid_id`, `researcher_id`, `scopus_id`, `overview`, `research_interests`, `contact_info`, `expert_raw_payload`)
- `api.role_type` — shared role lookup table (PI/CoPI/Researcher/Authorship/Editorship/etc.)
- `api.grant`, `api.grant_type`, `api.expert_grant_role` — MIV projection
- `api.work`, `api.work_type`, `api.expert_work_role` — SiteFarm projection

Key function: `etl_reporting.get_year_week(date)` — returns the ISO year-week string
(e.g. `2026-16`) for any date.

### Views

| View | Dashboard tab | Description |
|---|---|---|
| `command_error` | Errors | Commands joined with their errors; includes a Dagster run link for log access |
| `user_command_weekly_stats` | ETL Step Results | Per-user, per-command weekly state (`ok`, `error`, `no_attempt`) using the latest weekly attempt |
| `this_week_user_state_count` | Overview | Aggregate count of each ETL state for the current week |
| `user_command_weekly_state_changes` | ETL Step Results | Per-command state compared to the prior week; labels `changed-to-ok`, `changed-to-error`, `no-change` |
| `this_week_user_state_changes` | ETL Step Results | Current-week subset of command state changes |
| `user_scholarly_output_weekly_changes` | Scholarly Output | Week-over-week delta of work/grant counts by user, type, and visibility |
| `this_week_user_scholarly_output_changes` | Scholarly Output | Current-week scholarly output deltas |
| `user_left_this_week` | Overview | Users seen in the previous week but absent this week |
| `this_week_harvest_errors` | Errors | Current-week command failures with localized timestamps |

### Foreign keys and joins

- Solid FK: `error.command_id → command.command_id`
- Solid FK: `user_scholarly_output_load_stats.command_id → command.command_id`
- Logical (non-constrained): `command.user_id ↔ user.email`
- Logical (non-constrained): `command.year_week ↔ year_week.year_week`
- `elastic_search_index` is standalone (not joined to other tables in this schema)
