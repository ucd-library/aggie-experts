# Harvest Process

Aggie Experts v5 harvests researcher profiles, publications, and grants from the
[CDL Symplectic Elements API](https://support.symplectic.co.uk/support/solutions/folders/6000177986)
and the [UC Davis IAM API](https://iet-ws.ucdavis.edu/iet-ws/#/home).
The harvest is orchestrated by [Dagster](https://dagster.io) running in the
[project-anduin](https://github.com/ucd-library/project-anduin) ETL platform, with all
intermediate artifacts stored in [CaskFS](https://github.com/ucd-library/caskfs).

See the [Dagster Harvest Workflow](dagster-harvest-workflow.md) for the full asset/job/schedule
reference, and [Anduin Integration](anduin-integration.md) for the platform topology.

## Navigation

- [Architecture overview](#architecture-overview)
- [Data sources](#data-sources)
- [CaskFS artifact store](#caskfs-artifact-store)
- [ETL phases](#etl-phases)
  - [Phase 1: Extract + AE standard transform](#phase-1-extract--ae-standard-transform)
  - [Phase 2: Webapp transform + load](#phase-2-webapp-transform--load)
- [Node.js CLI commands](#nodejs-cli-commands)
- [Related docs](#related-docs)

## Architecture overview

```
CDL Symplectic API  ──┐
                      ├──► Celery Workers ──► CaskFS (weekly artifacts)
UC Davis IAM API    ──┘         │
                                └──► Elasticsearch (public index)

Dagster (in Anduin) orchestrates all steps via a Celery + RabbitMQ task queue.
CaskFS stores every intermediate artifact, content-addressed on a persistent disk volume.
```

Diagram: [aggie-experts-overview.mmd](aggie-experts-overview.mmd) |
[harvest-etl-flow.mmd](harvest-etl-flow.mmd)

## Data sources

| Source | URL | What is fetched |
|---|---|---|
| CDL Symplectic Elements | `https://oapolicy.universityofcalifornia.edu:8002/elements-secure-api/v6.13` | User records, publications, grant relationships |
| UC Davis IAM | `https://iet-ws.ucdavis.edu/api/iam` | Faculty/staff profile and affiliation data |
| Keycloak | `https://auth.library.ucdavis.edu/realms/aggie-experts` | Username/email lookup fallback for users not found in IAM |

CDL maintains a researcher group hierarchy. The weekly ETL harvests all members of the
`experts` group (production) or a smaller sandbox group for development. Grants originate
in [Aggie Enterprise](https://aggieenterprise.ucdavis.edu/) and are pushed to CDL Elements
via the [Grant Feed Process](grant-feed.md) before harvest.

## CaskFS artifact store

[CaskFS](https://github.com/ucd-library/caskfs) is a content-addressed file store with
a built-in RDF/linked-data layer. It replaces the local `cache/` directory and Fuseki
triple store used in earlier versions. All harvest artifacts are written to CaskFS and
shared between Dagster Celery workers via a persistent disk volume (NFS or local cluster storage).

### Path structure

```
/weekly/{year-week}/
  user/{userId}/
    cdl/             ← raw CDL XML/JSON-LD from extract step
    iam/             ← IAM profile JSON from extract step
    ae-std/          ← AE standard JSON-LD from transform_user_standard
      rel/           ← per-relationship JSON-LD files (works, grants)
    ae-webapp/       ← Elasticsearch-ready JSON-LD from transform_user_webapp
  work/              ← scholarly work artifacts
  grant/             ← grant artifacts
/archive/            ← long-term archived data
/id-map/{userId}     ← email → expert ID lookup files
```

The `year-week` segment (e.g. `2026-17`) is a CaskFS partition key — it scopes RDF queries
so the transform step can resolve cross-user linked-data relationships within the current
week's harvest without scanning the entire store.

CaskFS's CAS layer means that data which hasn't changed week-to-week is only written to
disk once, even though it is represented under each week's directory path. The extract and
transform steps always run and write their output paths — deduplication is transparent at
the storage level. The only application-level hash check is in the load step: before
indexing a document into Elasticsearch, the loader checks whether the same hash already
exists in that week's index and skips the write if so. This only provides a benefit within
a single week — either a single-user realtime refresh or an admin-triggered full reindex
within the same week's index.

### RDF queries in the transform step

The `transform_user_webapp` step uses CaskFS's built-in RDF `find` API to locate
related experts for a given publication or grant:

```js
const rdfResp = await this.caskFs.rdf.find({
  subject,
  partitionKeys: [yearWeek]
});
```

This replaces the Fuseki SPARQL queries used in earlier versions. CaskFS indexes every
JSON-LD file written to it, so linked-data relationships between researchers, works, and
grants are queryable without a separate triple store.

See the [CaskFS linked-data docs](https://github.com/ucd-library/caskfs/blob/main/docs/ld.md)
for the full query API.

## ETL phases

The weekly ETL runs in two sequential phases. Separating extract from load preserves
dependency ordering: the webapp transform step needs to resolve cross-user relationships,
so all users must complete phase 1 before phase 2 can start.

### Phase 1: Extract + AE standard transform

Triggered by the weekly schedule. Runs all user partitions in parallel via Celery workers.

**`extract_user`** — for each user:
1. Fetch user record, publications, and grant relationships from the CDL Symplectic API.
2. Fetch the IAM profile; fall back to a Keycloak lookup if IAM returns nothing.
3. Write raw data to CaskFS under `/weekly/{year-week}/user/{userId}/cdl/` and `iam/`.
4. Write an `id-map` entry linking the user's email to their expert ID.
5. Record extract stats to the PostgreSQL ETL reporting schema.

**`transform_user_standard`** — for each user:
1. Read CDL and IAM data from CaskFS.
2. Transform to [VIVO ontology](https://github.com/vivo-ontologies/vivo-ontology)-based
   [JSON-LD](https://json-ld.org/), the Aggie Experts standard linked-data format.
3. Write per-user and per-relationship JSON-LD files to `ae-std/`.

### Phase 2: Webapp transform + load

Triggered by the `etl_notify_and_continue` sensor once phase 1 completes. Only the
successful phase-1 partitions are passed to phase 2.

**`transform_user_webapp`** — for each user:
1. Read `ae-std/` data from CaskFS.
2. Query CaskFS's RDF graph to resolve related experts (co-authors, co-investigators).
3. Produce Elasticsearch-ready JSON-LD documents.
4. Write to `ae-webapp/`.

**`load_user`** — for each user:
1. Read `ae-webapp/` data from CaskFS.
2. Index expert, work, and grant documents into Elasticsearch under the `latest` alias.
3. Record load stats (document counts, index names) to the ETL reporting schema.

After acceptance testing, operators promote the `latest` alias to `public` using the
`set_alias` Dagster asset, making new data visible to the public webapp.

## Node.js CLI commands

The Dagster assets call into Node.js CLI commands installed in the `harvest` container.
Primary entry points under `harvest/bin/`:

| CLI command | Script | Purpose |
|---|---|---|
| `experts harvest extract run <userId>` | `experts-harvest-extract.js` | Phase 1 extract |
| `experts harvest transform ae-std <userId>` | `experts-harvest-transform.js` | Phase 1 transform |
| `experts harvest transform webapp <userId>` | `experts-harvest-transform.js` | Phase 2 transform |
| `experts harvest load <userId>` | `experts-harvest-load.js` | Phase 2 load to ES |
| `experts harvest dagster init-user-partitions <group>` | `experts-harvest-dagster.js` | Build partition list |
| `experts harvest dagster run-extract-users-job` | `experts-harvest-dagster.js` | Launch phase 1 backfill |
| `experts harvest dagster run-transform-load-users-job` | `experts-harvest-dagster.js` | Launch phase 2 backfill |
| `experts es ensure` | `experts-es.js` | Create/ensure current week ES index |
| `experts es set-alias <alias>` | `experts-es.js` | Set ES alias |
| `experts init` | `experts-init.js` | Initialize DB schemas |

## Related docs

- [Dagster Harvest Workflow](dagster-harvest-workflow.md) — full asset/job/schedule reference
- [Anduin Integration](anduin-integration.md) — platform topology and auth
- [Code and Data Deployment](experts-deploy-harvest.md) — how to deploy and operate
- [Digital Objects](digital-objects.md) — Elasticsearch document structure
- [Grant Feed Process](grant-feed.md) — how grants get from Aggie Enterprise into CDL
- [CaskFS docs](https://github.com/ucd-library/caskfs)
- [project-anduin docs](https://github.com/ucd-library/project-anduin)
