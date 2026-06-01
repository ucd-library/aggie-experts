# Dagster Harvest Workflow

This document describes the Dagster-based ETL pipeline in Aggie Experts v5, including:

- Dagster assets, jobs, schedules, and sensors
- Node.js CLI orchestration for extract, transform, and load
- CaskFS artifact storage paths
- Data sources and endpoints
- Realtime harvest API (webapp)
- ETL reporting schema and views

Dagster runs inside the [project-anduin](https://github.com/ucd-library/project-anduin)
platform. See [Anduin Integration](anduin-integration.md) for the platform topology and
[Harvest Process](harvest-process.md) for a narrative walkthrough of the ETL flow.

## Navigation

- [Overview](#overview)
- [Dagster assets, jobs, schedules, and sensor](#dagster-assets-jobs-schedules-and-sensor)
- [Node.js CLI orchestration (extract, transform, load)](#nodejs-cli-orchestration-extract-transform-load)
- [CaskFS artifact paths](#caskfs-artifact-paths)
- [Data sources and endpoints](#data-sources-and-endpoints)
- [Realtime harvest API (webapp)](#realtime-harvest-api-webapp)
- [Reporting: schema and views](#reporting-schema-and-views)
- [Operational notes](#operational-notes)
- [Related docs](#related-docs)

## Overview

The weekly ETL is orchestrated by Dagster assets defined in `dagster/defs.py`, executed
by Celery workers via RabbitMQ, with work performed by Node.js CLI commands under
`harvest/bin/`. All intermediate artifacts are stored in
[CaskFS](https://github.com/ucd-library/caskfs).

High-level flow:

1. Create/ensure the current week's Elasticsearch index and set the `latest` alias.
2. Pull current CDL group user list and initialize Dagster dynamic partitions.
3. Trigger partitioned phase 1 backfill (`extract_users_job`): extract + AE standard transform.
4. `etl_notify_and_continue` sensor detects phase 1 completion and triggers phase 2.
5. Partitioned phase 2 (`transform_load_users_job`): webapp transform + load to Elasticsearch.
6. Separate weekly cleanup job purges old CaskFS artifacts, Dagster runs, and reporting data.

Diagram: [harvest-etl-flow.mmd](harvest-etl-flow.mmd)

## Dagster assets, jobs, schedules, and sensor

Primary implementation: [`dagster/defs.py`](../dagster/defs.py) and
[`dagster/lib/`](../dagster/lib/).

### Assets

Assets are grouped by concern.

#### `init` group

- **`init_databases`** — runs `experts init` to initialize PostgreSQL schemas and ensure
  the current week's Elasticsearch indexes and aliases are in place.
- **`fetch_user_list_from_cdl`** — runs `experts harvest dagster init-user-partitions <group-id>`
  to fetch the CDL member list and create dynamic Dagster partitions (one per user).
  Depends on `ensure_current_index`.

#### `elasticsearch` group

- **`ensure_current_index`** — creates the current week's Elasticsearch index and sets
  the `latest` alias pointing to it.
- **`set_alias`** — manually set the `public` or `latest` alias to a specific year-week
  index. Used to promote a staged index to production.
- **`create_indexes`** — manually create a year-week index (normally handled by
  `ensure_current_index`).
- **`delete_indexes`** — delete a specific year-week index.
- **`get_current_es_state`** — print all indexes and alias pointers (diagnostic).
- **`reload_search_template`** — reload the Mustache search template into Elasticsearch.

#### `etl` group (partitioned by user)

- **`extract_user`** — fetch CDL + IAM data for a user; write to CaskFS.
  Depends on `init_databases`.
- **`transform_user_standard`** — transform to AE standard JSON-LD (VIVO ontology);
  write `ae-std/` to CaskFS. Depends on `extract_user`. Auto-materializes eagerly.
- **`transform_user_webapp`** — transform to Elasticsearch-ready JSON-LD; resolves
  cross-user RDF relationships via CaskFS linked-data layer; writes `ae-webapp/` to CaskFS.
  Depends on `transform_user_standard`. Auto-materializes eagerly.
- **`load_user`** — read `ae-webapp/` from CaskFS and index into Elasticsearch under the
  configured alias. Depends on `transform_user_webapp`. Auto-materializes eagerly.
- **`exec_weekly_etl`** — orchestrator asset; calls
  `experts harvest dagster run-extract-users-job` to launch the phase 1 backfill via the
  Dagster GraphQL API. Depends on `fetch_user_list_from_cdl`.

#### `cleanup` group

- **`purge_user_cask_files`** (partitioned) — delete a specific user's CaskFS files for
  a given year-week: `cask rm -d /weekly/{year_week}/{user_id}`.
- **`purge_year_week_cask_files`** — delete all CaskFS files for weeks older than 5 weeks
  (default). Runs with a 4-hour max runtime limit.
- **`purge_dagster_runs`** — purge Dagster run history older than 8 weeks.
- **`purge_reporting_db`** — clean ETL reporting DB: commands older than 8 weeks, inactive
  users older than 6 months.

### Jobs

| Job | Assets included | Description |
|---|---|---|
| `etl_users_job` | extract, transform_std, transform_webapp, load | Full ETL for a single partition. For realtime/ad-hoc refreshes. 40-min max runtime. |
| `start_weekly_etl_job` | ensure_current_index, fetch_user_list_from_cdl, exec_weekly_etl | Initialize index, build partition list, kick off phase 1. Weekly schedule entry point. |
| `extract_users_job` | extract_user, transform_user_standard | Phase 1 backfill. Low priority (`-1`). 30-min max runtime per partition. |
| `transform_load_users_job` | transform_user_webapp, load_user | Phase 2 backfill. Low priority (`-1`). |
| `cleanup` | purge_dagster_runs, purge_reporting_db, purge_year_week_cask_files | Weekly cleanup. 2-hour max runtime. |

### Schedules

| Schedule | Cron | Environment | Job |
|---|---|---|---|
| `weekly_elt_schedule_prod` | Saturday 01:00 AM PT | production | `start_weekly_etl_job` |
| `weekly_elt_schedule_dev` | Sunday 01:00 AM PT | dev | `start_weekly_etl_job` |
| `cleanup_schedule_prod` | Saturday 17:00 PM PT | production | `cleanup` |
| `cleanup_schedule_dev` | Sunday 17:00 PM PT | dev | `cleanup` |

The `start_weekly_etl_job` schedules pass `group_id=experts` (full production group) and
`notify=true` (Slack notification on completion).

### Sensor: `etl_notify_and_continue`

This sensor bridges phase 1 and phase 2 of the weekly ETL:

1. Watches active backfills for the `extract_users_job`.
2. Writes/updates ETL status to PostgreSQL.
3. Optionally sends Slack notifications (controlled by the `notify` run tag).
4. When `continue_etl=true` is set on the phase 1 run, triggers phase 2:

```bash
experts harvest dagster run-transform-load-users-job \
  --notify true \
  --partition-keys <successful-phase-1-partitions>
```

Only the partitions that succeeded in phase 1 are passed to phase 2.

## Node.js CLI orchestration (extract, transform, load)

Entry points under `harvest/bin/`:

| Command | Script | Description |
|---|---|---|
| `experts harvest extract ...` | `experts-harvest-extract.js` | Extract CDL + IAM data |
| `experts harvest transform ...` | `experts-harvest-transform.js` | AE standard or webapp transform |
| `experts harvest load ...` | `experts-harvest-load.js` | Load to Elasticsearch |
| `experts harvest dagster ...` | `experts-harvest-dagster.js` | Dagster GraphQL bridge |
| `experts es ...` | `experts-es.js` | Elasticsearch index/alias management |
| `experts init` | `experts-init.js` | Initialize DB schemas |

### Dagster CLI bridge

[`harvest/bin/experts-harvest-dagster.js`](../harvest/bin/experts-harvest-dagster.js)
calls the Dagster GraphQL API at `http://dagster-ui:3000/dagster/graphql`
([`harvest/lib/dagster/api.js`](../harvest/lib/dagster/api.js)).

Subcommands:

- `init-user-partitions <group-id>` — fetch CDL group members and register dynamic partitions.
- `run-extract-users-job [--group-id experts|dev|sandbox] [--skip N] [--notify] [--continue-etl] [--retries N]`
- `run-transform-load-users-job [--partition-keys key1,key2 | --partition-keys .] [--notify] [--retries N]`
- `get-backfill-details <backfill-id>`

### Extract step

`extract_user` asset runs:

```bash
experts harvest extract run <user-id> --reporting-job-id <dagster-run-id>
```

[`harvest/bin/experts-harvest-extract.js`](../harvest/bin/experts-harvest-extract.js):

- Fetches CDL + IAM data via `harvest/lib/extract/index.js`.
- Falls back to a Keycloak lookup if IAM returns no result.
- Writes raw data files to CaskFS (see [CaskFS artifact paths](#caskfs-artifact-paths)).
- Records extract stats if `--reporting-job-id` is provided.

### Transform steps

Phase 1 (`transform_user_standard`):

```bash
experts harvest transform ae-std <user-id> --reporting-job-id <dagster-run-id>
```

Phase 2 (`transform_user_webapp`):

```bash
experts harvest transform webapp <user-id> --reporting-job-id <dagster-run-id>
```

The webapp transform uses CaskFS's RDF `find` API to resolve linked-data relationships
across users within the current week's partition.

### Load step

`load_user` asset runs:

```bash
experts harvest load <user-id> --reporting-job-id <dagster-run-id> --alias <latest|public|all>
```

[`harvest/bin/experts-harvest-load.js`](../harvest/bin/experts-harvest-load.js)
reads `ae-webapp/` from CaskFS and indexes JSON-LD documents into Elasticsearch.

### Elasticsearch alias strategy

| Alias | Elasticsearch alias name | Meaning |
|---|---|---|
| `latest` | `latest` | Current week's index being built; visible to internal staging |
| `public` | `public` | Production index; visible to the public webapp |

Weekly ETL loads to `latest`. After acceptance testing, an operator runs the `set_alias`
Dagster asset to point `public` at the current week's index. The `--alias all` CLI flag
writes to both aliases simultaneously (used for ad-hoc realtime refreshes via
`etl_users_job`).

## CaskFS artifact paths

All paths are rooted in CaskFS. The `{year-week}` segment (e.g. `2026-17`) is a
CaskFS auto-path partition key.

| Path | Written by | Read by |
|---|---|---|
| `/weekly/{year-week}/user/{id}/cdl/` | `extract_user` | `transform_user_standard` |
| `/weekly/{year-week}/user/{id}/iam/` | `extract_user` | `transform_user_standard` |
| `/weekly/{year-week}/user/{id}/ae-std/` | `transform_user_standard` | `transform_user_webapp` |
| `/weekly/{year-week}/user/{id}/ae-std/rel/` | `transform_user_standard` | CaskFS RDF layer |
| `/weekly/{year-week}/user/{id}/ae-webapp/` | `transform_user_webapp` | `load_user` |
| `/id-map/{expertId}` | `extract_user` | ID resolution utilities |

Old year-week directories are purged by the weekly `cleanup` job (default: older than
5 weeks). CaskFS's CAS layer means data that hasn't changed week-to-week is stored on
disk only once, even though it appears under each week's directory path — deduplication
is transparent at the storage level, not a skip-the-step optimization.

See [CaskFS docs](https://github.com/ucd-library/caskfs) for the storage and RDF API.

## Data sources and endpoints

Primary runtime config: [`commons/lib/config.js`](../commons/lib/config.js).

### Source systems

- **CDL Symplectic Elements API (prod)**:
  `https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v6.13`
- **IAM API (prod)**:
  `https://iet-ws.ucdavis.edu/api/iam`

### Internal service endpoints

- **Dagster GraphQL**:
  - host: `http://dagster-ui:3000/dagster`
  - path: `/graphql`
- **PostgreSQL** (reporting + Dagster metadata):
  - env: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- **Elasticsearch**:
  - host/port: `ES_HOST` / `ES_PORT`
  - indexes: `experts`, `works`, `grants`
  - aliases: `latest` (stage), `public` (production)
- **CaskFS**:
  - env: `CASK_URL=http://caskfs-ui:3000`
  - root: `CASKFS_ROOT_DIR=/opt/cache`
- **RabbitMQ** (Celery broker):
  - `pyamqp://guest:guest@rabbitmq:5672//`

## Realtime harvest API (webapp)

Implemented in [`webapp/models/harvest/api.js`](../webapp/models/harvest/api.js) and
consumed by the SPA's `DagsterService`. These endpoints allow a user to trigger an
on-demand harvest of their own profile from the webapp UI:

- `POST /api/harvest/run-job-partition` — launch a Dagster `etl_users_job` run for the requesting user's partition.
- `GET /api/harvest/run/:runId` — poll run status/details.
- `POST /api/harvest/last-runs-for-partition` — get recent run history for the user's partition.

## Reporting: schema and views

Schema initialized from [`harvest/lib/reporting/schema.sql`](../harvest/lib/reporting/schema.sql),
which creates two PostgreSQL schemas:

- `etl_reporting` — ETL run observability (commands, errors, weekly state views)
- `api` — API-shaped projection consumed by the webapp's MIV and SiteFarm
  endpoints (user identity, grants, works, and their role join tables)

Both are visualized in Superset via the Anduin platform.

Entity-relationship diagram: [Reporting Database ERD](reporting-schema-erd.md).

Core tables — `etl_reporting`:

- `etl_reporting.command`
- `etl_reporting.error`
- `etl_reporting.user_scholarly_output_load_stats`
- `etl_reporting.validation_issue`
- `etl_reporting.elastic_search_index`
- `etl_reporting.year_week`

Core tables — `api`:

- `api.user` — expert identity and per-user privacy/profile fields
- `api.role_type` — shared role lookup (PI, CoPI, Authorship, Editorship, …)
- `api.grant`, `api.grant_type`, `api.expert_grant_role` — MIV projection
- `api.work`, `api.work_type`, `api.expert_work_role` — SiteFarm projection

Key views (all in `etl_reporting`, joining `api."user"` where needed):

- `etl_reporting.command_error`
- `etl_reporting.user_command_weekly_stats`
- `etl_reporting.this_week_user_state_count`
- `etl_reporting.user_command_weekly_state_changes`
- `etl_reporting.this_week_user_state_changes`
- `etl_reporting.user_scholarly_output_weekly_changes`
- `etl_reporting.this_week_user_scholarly_output_changes`
- `etl_reporting.user_left_this_week`
- `etl_reporting.this_week_harvest_errors`

## Operational notes

- Reporting is enabled per command via `--reporting-job-id`, and globally by environment
  (`ETL_REPORTING_ENABLED`).
- Dagster run tags `notify` and `continue_etl` control Slack notification and phase 2
  triggering behavior.
- The ETL deliberately runs in two phases to ensure cross-user RDF relationships in
  CaskFS are complete before the webapp transform reads them.
- Celery workers scale independently from the Dagster scheduler/daemon. Production runs
  3 workers; dev runs 2. Add workers to increase extract parallelism.
- To run a single-user realtime refresh, trigger `etl_users_job` from the Dagster UI
  for the desired partition.
- Superset dashboards are the primary ETL monitoring tool. For detailed run logs, use
  the Dagster UI (accessible via the anduin-gateway at port 4000).

## Related docs

- [Harvest Process](harvest-process.md)
- [Anduin Integration](anduin-integration.md)
- [Code and Data Deployment](experts-deploy-harvest.md)
- [Digital Objects](digital-objects.md)
- [Reporting Database ERD](reporting-schema-erd.md)
- [project-anduin docs](https://github.com/ucd-library/project-anduin)
- [CaskFS docs](https://github.com/ucd-library/caskfs)
- [aggie-experts-deployment repo](https://github.com/ucd-library/aggie-experts-deployment)
- [Main README](../README.md)
