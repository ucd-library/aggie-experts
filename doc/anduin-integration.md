# Anduin Integration

Aggie Experts v5 uses [project-anduin](https://github.com/ucd-library/project-anduin) as
its ETL and harvest platform. Anduin bundles Dagster, Apache Superset, CaskFS, and a
Keycloak OIDC auth gateway into a single deployable stack.

See the [project-anduin README](https://github.com/ucd-library/project-anduin) for the
canonical platform docs. This page covers how Aggie Experts integrates with and extends it.

## Navigation

- [Service topology](#service-topology)
- [anduin-gateway — AE custom image](#anduin-gateway--ae-custom-image)
- [Auth and roles](#auth-and-roles)
- [CaskFS configuration](#caskfs-configuration)
- [Dagster executor: Celery + RabbitMQ](#dagster-executor-celery--rabbitmq)
- [Superset dashboards](#superset-dashboards)
- [Related docs](#related-docs)

## Service topology

Diagram: [anduin-integration.mmd](anduin-integration.mmd)

All services run in the same network. The auth gateway is the only public entry point.

| Service | Image | Port / Path | Purpose |
|---|---|---|---|
| **anduin-gateway** | `ae-anduin-gateway` (custom) | `:4000` | OIDC auth + reverse proxy to all services |
| **dagster-ui** | `project-anduin` | `:3000` → `/dagster` | Dagster web UI |
| **dagster-daemon** | `project-anduin` | — | Scheduler, sensor runner |
| **dagster-celery-worker** | `project-anduin` + harvest | — | Task execution workers (×2 dev, ×3 prod) |
| **rabbitmq** | RabbitMQ | `:5672` | Celery task broker |
| **caskfs-ui** | `caskfs` | `:3001` → `/cask` | CaskFS file store + RDF graph |
| **superset** | `superset` | `:8088` → `/superset` | ETL dashboards |
| **postgres** | `ae-postgres` | `:5432` | Shared DB: Dagster metadata + ETL reporting |
| **webapp** | `webapp` | public | SPA + API (separate service group) |
| **kibana** | `kibana` | `:5601` → `/kibana` | Elasticsearch admin |
| **elasticsearch** | `elastic-search` | `:9200` | Search index |

Services are organized into two logical groups in the
[deployment repo](https://github.com/ucd-library/aggie-experts-deployment):

- **`anduin`** — ETL/harvest stack: gateway, Dagster (ui, daemon, workers), CaskFS, Superset, PVCs
- **`webapp`** — public-facing app: Express gateway, Lit SPA, REST API

Shared infrastructure (postgres, rabbitmq, elasticsearch, kibana) sits outside both groups.

## anduin-gateway — AE custom image

Aggie Experts builds its own `anduin-gateway` image that extends the base
[project-anduin auth gateway](https://github.com/ucd-library/project-anduin#auth-and-roles)
(`ANDUIN_AUTH_GATEWAY_IMAGE`) with two additions:

1. **CaskFS build info** — the CaskFS image (`CASKFS_IMAGE`) is used as a build-stage
   source to copy `/cork-build-info/caskfs.json` into the gateway image for build tracking.

2. **Additional service links** — the file `anduin-gateway/additional-services.json`
   registers AE-specific services in the gateway's navigation sidebar:

   | Service | URL | Role required |
   |---|---|---|
   | Webapp | `${AE_URL}` | public |
   | Kibana | `http://kibana:5601` | `kibana` |

   These appear alongside the standard Dagster, CaskFS, and Superset links in the
   gateway UI. Any service registered here will appear as a link in the Anduin nav
   (internal services proxy through the gateway; public ones open directly).

See [`anduin-gateway/Dockerfile`](../anduin-gateway/Dockerfile) and
[`anduin-gateway/additional-services.json`](../anduin-gateway/additional-services.json).

For adding more services, see the
[project-anduin auth docs](https://github.com/ucd-library/project-anduin/blob/main/docs/auth.md).

## Auth and roles

The gateway uses Keycloak OIDC at `https://auth.library.ucdavis.edu/realms/aggie-experts`,
client ID `anduin`. Roles are assigned in Keycloak and injected as an `x-anduin-user`
header on every proxied request.

| Keycloak role | Access granted |
|---|---|
| `admin` | Full access to all services |
| `execute` | Dagster UI (all features) |
| `dashboard` | Superset read/interact |
| `dashboard-admin` | Superset admin |
| `caskfs-user` | CaskFS read/write (prefix stripped → `user`) |
| `caskfs-admin` | CaskFS admin (prefix stripped → `admin`) |
| `kibana` | Kibana access |

See the [project-anduin roles docs](https://github.com/ucd-library/project-anduin/blob/main/docs/roles.md).

## CaskFS configuration

CaskFS stores all harvest artifacts. Key environment variables set in the
[deployment repo](https://github.com/ucd-library/aggie-experts-deployment):

| Variable | Value | Description |
|---|---|---|
| `CASKFS_ROOT_DIR` | `/opt/cache` | Root dir for the shared PVC volume |
| `EXPERTS_CACHE_ROOT_DIR` | `/opt/cache` | Same volume, referenced by harvest CLI |
| `CASKFS_PG_HOST` | `postgres` | Shared PostgreSQL for CaskFS metadata |
| `CASKFS_ACL_ENABLED` | `false` | ACL disabled (gateway handles auth) |
| `CASKFS_WEBAPP_PORT` | `3000` | CaskFS HTTP server port |
| `CASKFS_LOG_LEVEL` | `warn` (dev) | Log verbosity |

The CaskFS volume (`/opt/cache`) is a persistent disk mount (NFS or local cluster storage).
The harvest CLI sets auto-path partition rules so that CaskFS automatically assigns
`year-week`, `user`, and `transform-type` partition keys based on file path patterns.

See the [CaskFS auto-path docs](https://github.com/ucd-library/caskfs/blob/main/docs/auto-path.md)
and [CaskFS RBAC docs](https://github.com/ucd-library/caskfs/blob/main/docs/rbac.md).

## Dagster executor: Celery + RabbitMQ

Aggie Experts uses the `dagster-celery` executor so that partitioned ETL assets run as
distributed tasks across multiple workers rather than sequentially in a single process.

```python
# dagster/defs.py
executor=celery_executor.configured({
    "broker": "pyamqp://guest:guest@rabbitmq:5672//",
    "backend": "rpc://"
})
```

Worker count: ×2 in dev (microk8s), ×3 in production (Docker Compose). Each worker
mounts the shared CaskFS volume and the GCP service account, so all workers share the
same artifact store.

The Dagster daemon handles scheduling (`weekly_elt_schedule_prod`/`_dev`,
`cleanup_schedule_prod`/`_dev`) and runs the `etl_notify_and_continue` sensor that
bridges phase 1 and phase 2 of the weekly ETL.

## Superset dashboards

Superset is pre-loaded with a dashboard ZIP from GCS at startup
(`DASHBOARD_FILE=gs://anduin-dashboards/dashboard_prod.zip`). The dashboard
visualizes ETL reporting data from the `etl_reporting` PostgreSQL schema.

Access Superset at `/superset` through the anduin-gateway. Roles:
- `dashboard` → Superset `Alpha` (view + interact)
- `dashboard-admin` → Superset `Admin`

See the [project-anduin Superset docs](https://github.com/ucd-library/project-anduin/blob/main/docs/superset.md).

## Related docs

- [project-anduin README](https://github.com/ucd-library/project-anduin)
- [CaskFS README](https://github.com/ucd-library/caskfs)
- [aggie-experts-deployment repo](https://github.com/ucd-library/aggie-experts-deployment)
- [Harvest Process](harvest-process.md)
- [Dagster Harvest Workflow](dagster-harvest-workflow.md)
- [Code and Data Deployment](experts-deploy-harvest.md)
