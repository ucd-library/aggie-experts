# Aggie Experts Deployment

Aggie Experts v5 is deployed via a dedicated GitOps repository:
[aggie-experts-deployment](https://github.com/ucd-library/aggie-experts-deployment).
Images are built with
[cork-kube](https://github.com/ucd-library/cork-kube) and published to Google Artifact
Registry. There are two environments:

| Environment | Platform | Host | Notes |
|---|---|---|---|
| **dev** | Kubernetes (microk8s) | `libk8s` cluster, `aggie-experts-dev` namespace | Updated first for validation |
| **prod** | Docker Compose | `experts-anduin.library.ucdavis.edu` | Managed by systemd |

The ETL/harvest runs automatically on a weekly schedule via Dagster. Operators interact
with it through the Anduin auth gateway at port 4000.

## Navigation

- [Building and tagging images](#building-and-tagging-images)
- [Updating a deployment](#updating-a-deployment)
  - [Dev (Kubernetes)](#dev-kubernetes)
  - [Production (Docker Compose)](#production-docker-compose)
- [Running the ETL](#running-the-etl)
  - [Weekly automatic schedule](#weekly-automatic-schedule)
  - [Triggering an ETL run manually](#triggering-an-etl-run-manually)
  - [Realtime single-user refresh](#realtime-single-user-refresh)
  - [Promoting a staged index to production](#promoting-a-staged-index-to-production)
- [Local development](#local-development)
- [Related docs](#related-docs)

## Building and tagging images

Images are built with Google Cloud Build via `cork-kube build gcb`. The available build
versions and their dependency pins (CaskFS, project-anduin, Postgres) are defined in the
[cork-build-registry](https://github.com/ucd-library/cork-build-registry).

```bash
# Tag a release in aggie-experts
git tag 5.0.1
git push origin 5.0.1

# Build (GCB triggers on tag, or trigger manually)
cork-kube build gcb -p aggie-experts -v 5.0.1
```

Published images:

```
us-west1-docker.pkg.dev/aggie-experts/pub/harvest:<version>
us-west1-docker.pkg.dev/aggie-experts/pub/webapp:<version>
us-west1-docker.pkg.dev/aggie-experts/pub/ae-postgres:<version>
us-west1-docker.pkg.dev/aggie-experts/pub/elastic-search:<version>
us-west1-docker.pkg.dev/aggie-experts/pub/anduin-gateway:<version>
```

## Updating a deployment

All deployment changes are made in the
[aggie-experts-deployment](https://github.com/ucd-library/aggie-experts-deployment) repo.

### Dev (Kubernetes)

```bash
cd aggie-experts-deployment
./cmds/update-deployment.sh dev 5.0.1
```

This resolves dependency versions (CaskFS, Anduin, Postgres) from the cork-build-registry,
patches the kustomize image tags for the `aggie-experts-dev` namespace, and commits and
pushes the changes.

Apply to the cluster:

```bash
cork-kube apply -e dev
```

Or apply a specific service group only:

```bash
cork-kube apply -e dev -g anduin
cork-kube apply -e dev -g webapp
```

### Production (Docker Compose)

```bash
cd aggie-experts-deployment
./cmds/update-deployment.sh prod 5.0.1
```

This patches `compose/prod/compose.yaml` with the new image tags, then commits and pushes.

**Option 1 — Deploy remotely** (from your workstation):

```bash
./compose/prod/remote-update-cluster.sh webapp
./compose/prod/remote-update-cluster.sh anduin
```

This SSHes to `experts-anduin.library.ucdavis.edu` and runs `update-cluster.sh` there.

**Option 2 — Deploy on-host** (SSH to the server first):

```bash
ssh experts-anduin.library.ucdavis.edu
cd /opt/aggie-experts-deployment
git pull
./compose/prod/update-cluster.sh webapp   # zero-downtime rolling restart
./compose/prod/update-cluster.sh anduin   # ETL stack restart
./compose/prod/update-cluster.sh all      # full restart (brief downtime)
```

The `webapp` group (Express gateway, Lit SPA, REST API) can be restarted with no downtime.
The `anduin` group (Dagster, CaskFS, Superset, gateway) involves a brief ETL interruption
but does not affect the public webapp. Use `all` only when shared infrastructure (postgres,
elasticsearch) needs to be restarted.

### Deployment pattern

Always update **dev first**, validate, then update **prod**:

```
update-deployment.sh dev 5.0.1  →  validate on anduin-dev.experts.library.ucdavis.edu
update-deployment.sh prod 5.0.1 →  deploy to experts-anduin.library.ucdavis.edu
```

Commit messages in the deployment repo follow the pattern:
```
Updated prod to version 5.0.1 (CaskFS: 0.1.1, Anduin: 0.1.2, Postgres: 16)
```

## Running the ETL

### Weekly automatic schedule

The ETL runs automatically every week via Dagster schedules:

| Schedule | Cron | Environment |
|---|---|---|
| `weekly_elt_schedule_prod` | Saturday 01:00 AM PT | production (`group_id=experts`) |
| `weekly_elt_schedule_dev` | Sunday 01:00 AM PT | dev |
| `cleanup_schedule_prod` | Saturday 17:00 PM PT | production |
| `cleanup_schedule_dev` | Sunday 17:00 PM PT | dev |

Monitor progress in the Dagster UI at `https://experts-anduin.library.ucdavis.edu/dagster`
(requires `execute` or `admin` role in Keycloak).

ETL summary dashboards are in Superset at
`https://experts-anduin.library.ucdavis.edu/superset`.

### Triggering an ETL run manually

To run a full ETL manually, trigger `start_weekly_etl_job` from the Dagster UI:

1. Open `https://experts-anduin.library.ucdavis.edu/dagster`.
2. Navigate to **Jobs → start_weekly_etl_job**.
3. Click **Materialize all** (or **Launch run**).
4. Set `group_id` to `experts` (full list) or a sandbox group ID for testing.

Alternatively, from inside the harvest container:

```bash
experts harvest dagster run-extract-users-job \
  --group-id experts \
  --notify true \
  --continue-etl true
```

`--continue-etl true` causes the `etl_notify_and_continue` sensor to automatically
trigger phase 2 once phase 1 completes.

### Realtime single-user refresh

To re-harvest a single researcher (e.g. after a profile update):

1. In the Dagster UI, go to **Jobs → etl_users_job**.
2. Select the target user partition.
3. Click **Launch run**.

Or from the webapp admin panel (if enabled for your role).

### Promoting a staged index to production

After a weekly ETL, the new data lands in the `latest` Elasticsearch alias. To promote
it to the `public` alias (visible to the webapp):

1. Validate data on the staging-facing app.
2. In the Dagster UI, run the **`set_alias`** asset with:
   - `alias`: `public`
   - `year_week`: the current year-week (e.g. `2026-17`)

Or from the command line inside the harvest container:

```bash
experts es set-alias public --year-week 2026-17
```

## Local development

Clone the deployment repo and follow the quick-start:

```bash
git clone https://github.com/ucd-library/aggie-experts-deployment
cd aggie-experts-deployment

# First run: fetch secrets and build images
./cmds/init.sh
./cmds/build-local-dev.sh

# Start the stack
./cmds/up.sh local-dev
```

Services available locally:

| Service | URL |
|---|---|
| Anduin gateway (Dagster, CaskFS, Superset) | `http://localhost:4000` |
| Aggie Experts webapp | `http://localhost:8080` |

The local dev compose uses volume-mounted source from the aggie-experts repo, so code
changes are reflected without rebuilding images.

See the [aggie-experts-deployment README](https://github.com/ucd-library/aggie-experts-deployment)
for full local dev setup details.

## Related docs

- [aggie-experts-deployment repo](https://github.com/ucd-library/aggie-experts-deployment)
- [cork-kube](https://github.com/ucd-library/cork-kube) — build and deployment tooling
- [project-anduin](https://github.com/ucd-library/project-anduin) — ETL platform
- [CaskFS](https://github.com/ucd-library/caskfs) — artifact store
- [Harvest Process](harvest-process.md)
- [Dagster Harvest Workflow](dagster-harvest-workflow.md)
- [Anduin Integration](anduin-integration.md)
- [Docker Images and Deployment](docker-deployment.md)
