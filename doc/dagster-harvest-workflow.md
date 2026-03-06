# Dagster Harvest Workflow

This document describes the current Dagster-based harvest process in Aggie Experts, including:

- Dagster assets/jobs/schedules
- Node.js CLI orchestration for extract, transform, and load
- Data sources and data targets (CDL, IAM, PostgreSQL, Elasticsearch)
- Reporting APIs and reporting SQL views

## Navigation

- [Overview](#overview)
- [Dagster assets, jobs, schedules, and sensor](#dagster-assets-jobs-schedules-and-sensor)
- [Node.js CLI orchestration (extract, transform, load)](#nodejs-cli-orchestration-extract-transform-load)
- [Data sources and endpoints](#data-sources-and-endpoints)
- [Reporting: APIs and views](#reporting-apis-and-views)
- [Operational notes](#operational-notes)
- [Related docs](#related-docs)

## Overview

The weekly ETL is orchestrated by Dagster assets in `dagster/defs.py`, with work executed by Node.js CLI commands under `harvest/bin`.

High-level flow:

1. Initialize Elasticsearch week index + aliases.
2. Pull current CDL group user list and initialize Dagster partitions.
3. Run partitioned extraction + AE standard transform (`extract_users_job`).
4. Sensor detects backfill completion and optionally triggers partitioned webapp transform + load (`transform_load_users_job`).
5. Record command/error/load stats in PostgreSQL reporting schema.

## Dagster assets, jobs, schedules, and sensor

Primary implementation: [`dagster/defs.py`](../dagster/defs.py).

### Assets

- `init_databases`: runs `experts init` (initializes supporting DB/schema components).
- `ensure_current_index`: runs `experts es ensure` and sets `stage` alias to current week.
- `fetch_user_list_from_cdl`: runs `experts harvest dagster init-user-partitions <group-id>`.
- `extract_user` (partitioned by user): runs extraction CLI.
- `transform_user_standard` (partitioned): runs AE standard transform CLI.
- `transform_user_webapp` (partitioned): runs webapp transform CLI.
- `load_user` (partitioned): runs load CLI to Elasticsearch alias (`stage`, `current`, or `all`).
- `exec_weekly_etl`: orchestrator asset that triggers a full backfill via CLI.

### Jobs

- `etl_users_job`: realtime full ETL for a partition (`extract_user`, `transform_user_standard`, `transform_user_webapp`, `load_user`).
- `extract_users_job`: weekly phase 1 (`extract_user`, `transform_user_standard`).
- `transform_load_users_job`: weekly phase 2 (`transform_user_webapp`, `load_user`).
- `init_weekly_etl`: initialization (`ensure_current_index`, `fetch_user_list_from_cdl`).

### Schedules

- `weekly_elt_init_schedule`: Saturday 01:00 America/Los_Angeles.
- `weekly_elt_schedule`: Saturday 01:30 America/Los_Angeles.

### Sensor continuation logic

`etl_notify_and_continue` watches active backfills, writes/updates status in PostgreSQL, optionally sends Slack notifications, and when `continue_etl=true` for `extract_users_job`, triggers:

- `experts harvest dagster run-transform-load-users-job --notify true --partition-keys .`

The partition keys passed to phase 2 are the successful partitions from phase 1.

## Node.js CLI orchestration (extract, transform, load)

Entry points:

- `experts harvest extract ...` -> [`harvest/bin/experts-harvest-extract.js`](../harvest/bin/experts-harvest-extract.js)
- `experts harvest transform ...` -> [`harvest/bin/experts-harvest-transform.js`](../harvest/bin/experts-harvest-transform.js)
- `experts harvest load ...` -> [`harvest/bin/experts-harvest-load.js`](../harvest/bin/experts-harvest-load.js)
- `experts harvest dagster ...` -> [`harvest/bin/experts-harvest-dagster.js`](../harvest/bin/experts-harvest-dagster.js)

### Dagster CLI bridge

[`harvest/bin/experts-harvest-dagster.js`](../harvest/bin/experts-harvest-dagster.js) provides Dagster orchestration helpers:

- `init-user-partitions <group-id>`
- `run-extract-users-job [--group-id experts|dev|sandbox] [--skip N] [--notify] [--continue-etl] [--retries N]`
- `run-transform-load-users-job [--partition-keys key1,key2 | --partition-keys .] [--notify] [--retries N]`
- `get-backfill-details <backfill-id>`

It uses [`harvest/lib/dagster/api.js`](../harvest/lib/dagster/api.js) to call Dagster GraphQL (`launchPartitionBackfill` and detail queries).

### Extract step

`extract_user` asset executes:

- `experts harvest extract run <user-id> --reporting-job-id <dagster-run-id>`

[`harvest/bin/experts-harvest-extract.js`](../harvest/bin/experts-harvest-extract.js) performs:

- CDL + IAM extraction through `harvest/lib/extract/index.js`
- Keycloak lookup fallback for not-found users
- cache writes under configured cache root
- optional reporting inserts (`--reporting` or `--reporting-job-id`)

### Transform steps

Phase 1 (`transform_user_standard`):

- `experts harvest transform ae-std <user-id> --reporting-job-id <dagster-run-id>`

Phase 2 (`transform_user_webapp`):

- `experts harvest transform webapp <user-id> --reporting-job-id <dagster-run-id>`

Transform behavior is implemented in [`harvest/bin/experts-harvest-transform.js`](../harvest/bin/experts-harvest-transform.js) and related libraries under [`harvest/lib/transform/`](../harvest/lib/transform).

### Load step

`load_user` asset executes:

- `experts harvest load <user-id> --reporting-job-id <dagster-run-id> --alias <stage|current|all>`

[`harvest/bin/experts-harvest-load.js`](../harvest/bin/experts-harvest-load.js) calls [`harvest/lib/load/index.js`](../harvest/lib/load/index.js), which loads transformed JSON documents into Elasticsearch and returns updated index mappings.

## Data sources and endpoints

Primary runtime config: [`harvest/lib/config.js`](../harvest/lib/config.js).

### Source systems

- CDL Symplectic Elements API (prod):
  - `https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v6.13`
- IAM API (prod):
  - `https://iet-ws.ucdavis.edu/api/iam`

### Internal service endpoints

- Dagster GraphQL:
  - default host: `http://dagster-ui:3000/dagster`
  - GraphQL path: `/graphql`
- PostgreSQL (reporting + Dagster run metadata usage):
  - env-driven (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`)
- Elasticsearch:
  - host/port from `ES_HOST`/`ES_PORT`
  - default indices: `experts`, `works`, `grants`
  - aliases used by load flow: `stage`, `current` (and CLI alias mode `all`)

## Reporting: APIs and views

### Reporting API endpoints (webapp)

Implemented in [`webapp/models/harvest/api.js`](../webapp/models/harvest/api.js) and used by the SPA Dagster service ([`webapp/spa/client/public/lib/services/DagsterService.js`](../webapp/spa/client/public/lib/services/DagsterService.js)):

- `POST /api/harvest/run-job-partition`
  - Launch a Dagster run for a specific partition.
- `GET /api/harvest/run/:runId`
  - Get run status/details.
- `POST /api/harvest/last-runs-for-partition`
  - Get recent run history for a partition.

### Reporting schema and SQL views

Reporting schema is initialized from [`harvest/lib/reporting/schema.sql`](../harvest/lib/reporting/schema.sql) (`etl_reporting` schema).

Entity-relationship diagram: [Reporting Database ERD](reporting-schema-erd.md).

Core reporting tables include:

- `etl_reporting.command`
- `etl_reporting.error`
- `etl_reporting.user`
- `etl_reporting.user_scholarly_output_load_stats`
- `etl_reporting.elastic_search_index`
- `etl_reporting.year_week`

Key function:

- `etl_reporting.get_year_week(date)`

Key views:

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

- Reporting is enabled per command via `--reporting` or `--reporting-job-id`, and globally by environment (`ETL_REPORTING_ENABLED`).
- Dagster backfill tags (`notify`, `continue_etl`) control notification and phase-2 continuation behavior.
- The ETL intentionally runs as two weekly phases to preserve dependency ordering:
  - phase 1: extract + AE standard transform
  - phase 2: webapp transform + load

## Related docs

- [Harvest process](harvest-process.md)
- [Code and data deployment](experts-deploy-harvest.md)
- [Digital objects](digital-objects.md)
- [Main README](../README.md)
