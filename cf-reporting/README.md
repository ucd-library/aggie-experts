# cf-reporting

CLI that exports Cloudflare zone analytics (API call volume, bot vs. human traffic, top pages, country breakdown) as CSV reports, using Cloudflare's GraphQL Analytics API.

## Setup

```bash
npm install
cp .env.example .env
```

Then fill in `.env`:

1. **API token** (`CF_API_TOKEN`) - create one at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) using the "Create Custom Token" option, scoped to the zone you're reporting on, with permission **Zone > Analytics > Read**. (If you plan to use the ad-hoc `query` command against account-level datasets, also add **Account > Account Analytics > Read**.)
2. **Account ID** and **Zone ID** (`CF_ACCOUNT_ID`, `CF_ZONE_ID`) - both are shown on the zone's **Overview** page in the Cloudflare dashboard, in the right-hand sidebar.
3. **App name** (`CF_APP_NAME`) - a human-readable label (e.g. `aggie-experts`) used to name export folders. Falls back to the zone ID if left blank.

All other `.env.example` variables are optional overrides with sane defaults (commented out).

## Usage

```bash
# Default: last 30 days, all 7 precooked views, written to ./<app-name>-<start>-<end>/
cf-reporting export

# Last 7 days, zipped (the plain folder is deleted after zipping)
cf-reporting export --days 7 --zip

# Zipped and uploaded to GCS (or set AE_AF_GCS_BUCKET instead of the flag)
cf-reporting export --days 30 --zip --gcs-bucket cf-reports

# Explicit date range
cf-reporting export --start 2026-01-01 --end 2026-01-31

# Only specific views
cf-reporting export --views top-pages,country-breakdown

# All views except the bot/human-traffic ones
cf-reporting export --exclude-views bot-page-views,human-page-views,unique-bot-visitors,unique-human-visitors

# One view, single CSV to the current directory
cf-reporting views:top-pages --limit 25 --days 7

# Ad-hoc query, same underlying pipeline as the precooked views
cf-reporting query --dataset httpRequests1dGroups --sum requests --sum bytes --days 7
```

Run `cf-reporting <command> --help` for a command's full option list.

### Precooked views

| View | What it reports |
|---|---|
| `api-calls` | Count of requests by path under the configured API path prefix |
| `bot-page-views` | Bot page-view counts by real SPA route (`/api/*` calls rewritten to their front-end route) |
| `human-page-views` | Human page-view counts by real SPA route (`/api/*` calls rewritten to their front-end route) |
| `unique-bot-visitors` | Daily unique bot visitors, approximated by distinct client IPs |
| `unique-human-visitors` | Daily unique human visitors, approximated by distinct client IPs |
| `top-pages` | Top N pages by views (default 50, override with `--limit`) |
| `country-breakdown` | Request totals by country over the date range |

### Bot Management requirement

`bot-page-views`, `human-page-views`, `unique-bot-visitors`, and `unique-human-visitors` rely on Cloudflare's `botScore` field, which only returns meaningful data on zones with **Bot Management** enabled (an Enterprise-plan feature, or a paid Business add-on). Before running one of these views, the CLI probes whether bot-score data is actually available; if it isn't, it logs a warning and skips that view's CSV rather than writing empty or misleading data. `export` continues with the remaining views and exits non-zero if anything was skipped, so a cron job or CI run will notice.

`top-pages` uses Cloudflare's sampled/estimated `httpRequestsAdaptiveGroups` dataset, so counts on high-volume zones are estimates rather than exact totals.

## Testing

```bash
npm test
```

All tests mock the Cloudflare client - no live API calls or credentials are needed to run the suite.

## Deployment

See [`devops/`](devops/) for the Cloud Run Job + Cloud Scheduler setup that runs a 30-day
export automatically on the 1st of each month and writes the zip to the `cf-reports` GCS bucket.
