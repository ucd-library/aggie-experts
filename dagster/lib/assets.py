"""
Dagster asset definitions for the Aggie Experts ETL pipeline.
"""
import subprocess

import dagster as dg
from dagster import AssetExecutionContext, AutoMaterializePolicy

from .configs import (
    users_partitions,
    FetchUserListConfig,
    LoadUserConfig,
    YearWeekConfig,
    PurgeYearWeekConfig,
    PurgeStaleUserPartitionsConfig,
    NotifyConfig,
    SetAliasConfig,
    ReloadSearchTemplateConfig,
    SlackNotifyConfig,
)
from .utils import CODE_VERSION, exec


# ---------------------------------------------------------------------------
# Init / elasticsearch assets
# ---------------------------------------------------------------------------

@dg.asset(
    code_version=CODE_VERSION,
    group_name="init"
)
def init_databases(context) -> None:
    """Initialize PostgreSQL schema and ensure current weeks indexes in ElasticSearch as well as current and stage aliases."""
    cmd = ["experts", "init"]
    exec(cmd)
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="elasticsearch",
    tags={"dagster/priority": "3"}
)
def ensure_current_index(context) -> None:
    """Ensure current week index in ElasticSearch.  Set latest alias to this week."""
    cmd = ["experts", "es", "ensure"]
    exec(cmd)

    cmd = ["experts", "es", "set-alias", "latest", "--current"]
    exec(cmd)
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="elasticsearch"
)
def set_alias(context, config: SetAliasConfig) -> None:
    """Set current/stage aliases to indexes in ElasticSearch."""
    cmd = ["experts", "es", "set-alias", config.alias, "--year-week", config.year_week]
    exec(cmd)
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="elasticsearch"
)
def delete_indexes(context, config: YearWeekConfig) -> None:
    """Delete unused year-week indexes in ElasticSearch."""
    cmd = ["experts", "es", "delete-index", "--year-week", config.year_week]
    exec(cmd)
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="elasticsearch"
)
def create_indexes(context, config: YearWeekConfig) -> None:
    """Manually create year-week indexes in ElasticSearch.  FYI, normally you use ensure_current_index asset."""
    cmd = ["experts", "es", "create-index", "--year-week", config.year_week]
    exec(cmd)
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="elasticsearch"
)
def get_current_es_state(context) -> None:
    """Prints all indexes and alias pointers in ElasticSearch."""
    cmd = ["experts", "es", "state"]
    exec(cmd)
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="elasticsearch"
)
def reload_search_template(context, config: ReloadSearchTemplateConfig) -> None:
    """Reload the mustache search template into Elasticsearch."""
    exec(["experts", "es", "load-search-template", "--template", config.template])
    context.add_output_metadata({"template": config.template})
    return None


# ---------------------------------------------------------------------------
# Init assets
# ---------------------------------------------------------------------------

@dg.asset(
    code_version=CODE_VERSION,
    group_name="init",
    deps=[ensure_current_index]
)
def fetch_user_list_from_cdl(context, config: FetchUserListConfig) -> None:
    """Get current user list from CDL and create dynamic partitions."""
    result = exec(["experts", "harvest", "dagster", "init-user-partitions", config.group_id])

    context.add_output_metadata(
        metadata={
            "group_id": config.group_id
        }
    )


# ---------------------------------------------------------------------------
# ETL assets
# ---------------------------------------------------------------------------

@dg.asset(
    partitions_def=users_partitions,
    code_version=CODE_VERSION,
    deps=[init_databases],
    group_name="etl",
)
def extract_user(context) -> None:
    """Extract user data from CDL and store in CaskFS."""
    user_id = context.partition_key
    run = context.dagster_run

    cmd = ["experts", "harvest", "extract", "run", user_id, "--reporting-job-id", run.run_id]

    metadata = {"user": user_id}

    result = exec(cmd)
    if result.get('filesCount'):
        metadata["file_count"] = result.get('filesCount')

    context.add_output_metadata(metadata=metadata)
    return None


@dg.asset(
    partitions_def=users_partitions,
    code_version=CODE_VERSION,
    auto_materialize_policy=AutoMaterializePolicy.eager(),
    deps=[extract_user],
    group_name="etl",
)
def transform_user_standard(context: AssetExecutionContext) -> None:
    """Transform user data into the Aggie Experts Standard linked data format."""
    user_id = context.partition_key
    run = context.dagster_run

    exec(["experts", "harvest", "transform", "ae-std", user_id, "--reporting-job-id", run.run_id])

    context.add_output_metadata(metadata={"id": user_id})
    return None


@dg.asset(
    partitions_def=users_partitions,
    code_version=CODE_VERSION,
    auto_materialize_policy=AutoMaterializePolicy.eager(),
    deps=[transform_user_standard],
    group_name="etl",
)
def transform_user_webapp(context: AssetExecutionContext) -> None:
    """Transform user data into the Aggie Experts Elasticsearch Webapp linked data format."""
    user_id = context.partition_key
    run = context.dagster_run

    exec(["experts", "harvest", "transform", "webapp", user_id, "--reporting-job-id", run.run_id])

    context.add_output_metadata(metadata={"id": user_id})
    return None


@dg.asset(
    partitions_def=users_partitions,
    code_version=CODE_VERSION,
    auto_materialize_policy=AutoMaterializePolicy.eager(),
    deps=[transform_user_webapp],
    group_name="etl",
)
def load_user(context: AssetExecutionContext, config: LoadUserConfig) -> None:
    """Load transformed, webapp ready, user data into Elasticsearch."""
    user_id = context.partition_key
    run = context.dagster_run

    result = exec(["experts", "harvest", "load", user_id, "--reporting-job-id", run.run_id, "--alias", config.alias])

    metadata = {
        "id": user_id,
        "alias": config.alias
    }

    if result.get('indexes'):
        for key, value in result['indexes'].items():
            metadata[key] = value

    context.add_output_metadata(metadata=metadata)
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="etl",
    deps=[fetch_user_list_from_cdl]
)
def exec_weekly_etl(context: AssetExecutionContext, config: NotifyConfig) -> None:
    """Start the full weekly ETL process for all users."""
    cmd = ["experts", "harvest", "dagster", "run-extract-users-job"]
    if config.notify == "true" or context.dagster_run.tags.get("notify") == "true":
        cmd += ["--notify", "true"]
    cmd += ["--continue-etl", "true"]

    exec(cmd, no_json_parse=True)
    return None


# ---------------------------------------------------------------------------
# Post-ETL assets
# ---------------------------------------------------------------------------

@dg.asset(
    code_version=CODE_VERSION,
    group_name="etl"
)
def check_iam_lapsed_users(context: AssetExecutionContext) -> None:
    """Post-ETL: for users who dropped off CDL last week, check IAM and update last_seen_iam if still found."""
    result = exec(["experts", "harvest", "reporting", "check-iam-lapsed"])
    if result:
        context.add_output_metadata(metadata=result)
    return None


# ---------------------------------------------------------------------------
# Cleanup assets
# ---------------------------------------------------------------------------

@dg.asset(
    partitions_def=users_partitions,
    code_version=CODE_VERSION,
    group_name="cleanup",
)
def purge_user_cask_files(context: AssetExecutionContext, config: YearWeekConfig) -> None:
    """Purge user files from CaskFS."""
    user_id = context.partition_key

    year_week = config.year_week
    if not year_week:
        raise ValueError("year_week must be provided in YearWeekConfig")

    exec(["cask", "rm", "-d", f"/weekly/{year_week}/{user_id}"])
    return None

@dg.asset(
    code_version=CODE_VERSION,
    group_name="cleanup",
)
def purge_stale_user_partitions(context: AssetExecutionContext, config: PurgeStaleUserPartitionsConfig) -> None:
    """Remove Dagster user partitions for users no longer in the CDL group.

    Reads the current users-list-<group_id>.json from CaskFS (falling back to
    a live CDL fetch), diffs against Dagster's 'users' dynamic partitions, and
    deletes any partition not in the current list. Defaults to a dry-run; set
    config.force=True to actually delete. When force=True, records one
    'experts-harvest-remove-partition' row per removed partition in
    etl_reporting.command.
    """
    run = context.dagster_run

    cmd = ["experts", "harvest", "dagster", "remove-stale-user-partitions", config.group_id]
    if config.force:
        cmd += ["--yes", "--reporting-job-id", run.run_id]

    exec(cmd, no_json_parse=True)

    context.add_output_metadata(metadata={
        "group_id": config.group_id,
        "force": config.force,
        "dry_run": not config.force,
    })
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="cleanup",
    tags={
        "dagster/retries": "0",
        "dagster/max_runtime": str(60 * 60 * 4)  # 4 hour max runtime
    }
)
def purge_year_week_cask_files(context: AssetExecutionContext, config: PurgeYearWeekConfig) -> None:
    """Purge all files from CaskFS before a given year-week.  Defaults to 5 weeks ago if year-week not provided."""
    year_week = config.year_week
    if not year_week:
        year_week = subprocess.check_output(
            ["experts", "harvest", "year-week", "--weeks-ago", "5"], text=True
        ).strip()

    print(f"Purging CaskFS files for year-week {year_week}")
    exec(["cask", "rm", "-d", f"/weekly/{year_week}"], no_json_parse=True)
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="cleanup",
    tags={
        "dagster/max_runtime": str(60 * 60 * 2)  # 2 hour max runtime
    }
)
def purge_dagster_runs(context: AssetExecutionContext) -> None:
    """Purge runs more than 8 weeks old."""
    exec(
        ["python", "/opt/dagster/dagster_home/dagster_cleanup.py", "--weeks", "8", "--yes"],
        no_json_parse=True
    )
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="cleanup"
)
def purge_reporting_db(context: AssetExecutionContext) -> None:
    """Purge commands more than 8 weeks old.  Purge users not seen for 6 months."""
    exec(
        ["experts", "harvest", "reporting", "clean", "--commands", "8", "--users", "26", "--yes"],
        no_json_parse=True
    )
    return None


# ---------------------------------------------------------------------------
# Admin assets
# ---------------------------------------------------------------------------

@dg.asset(
    code_version=CODE_VERSION,
    group_name="admin",
)
def send_slack_notification(context: AssetExecutionContext, config: SlackNotifyConfig) -> None:
    """Send a Slack notification via the admin CLI."""
    exec(
        ["experts", "admin", "notify",
         "--title", config.title,
         "--message", config.message,
         "--severity", config.severity,
         "--source", config.source],
        no_json_parse=True
    )
    return None


# ---------------------------------------------------------------------------
# Grant-feed assets (Aggie Enterprise -> Symplectic)
# ---------------------------------------------------------------------------

@dg.asset(
    code_version=CODE_VERSION,
    group_name="grant_feed",
)
def check_grant_feed_email(context: AssetExecutionContext) -> None:
    """Check the configured inbox for a new AEgrants.xml.

    ON HOLD (security review): this asset and its schedules are NOT registered
    in defs.py, so it does not run automatically. Input is placed in GCS
    manually and grant_feed_job is triggered by hand. Kept here (with its job
    and schedules) so it can be re-enabled by re-registering in defs.py.

    On finding one, the CLI stages it in CasKFS under the current week
    (/weekly/<year-week>/grant-feed/ae-grants.xml) and this asset launches
    grant_feed_job to run the ETL. If nothing new is found (or the email
    backend is still the stub), it no-ops. If the inbox cannot be
    reached/checked, a Slack alert is sent and the run fails.
    """
    try:
        result = exec(["experts", "harvest", "grant-feed", "check-email"])
    except Exception as e:
        _slack_notify(
            context,
            "Grant feed email check FAILED",
            f"Could not reach/check the grant-feed inbox: {e}",
            "error",
        )
        raise

    found = bool(result and result.get("found"))
    context.add_output_metadata(metadata={"found": found, **(result or {})})

    if found:
        # The dev deployment uploads to Symplectic QA; prod uploads to PROD.
        # The schedule tags the run env=dev|prod (default prod for manual runs).
        symplectic_env = "QA" if context.dagster_run.tags.get("env") == "dev" else "PROD"
        context.log.info(f"New AE grant input found; launching grant_feed_job (Symplectic {symplectic_env}).")
        exec(["experts", "harvest", "dagster", "run-grant-feed-job", "--env", symplectic_env], no_json_parse=True)
    else:
        context.log.info(f"No new AE grant input to process: {result}")
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="grant_feed",
    tags={
        "dagster/max_runtime": str(60 * 30)  # 30 minute max runtime
    }
)
def grant_feed_ingest(context: AssetExecutionContext) -> None:
    """Run the weekly AE grant-feed ETL for the current week.

    Manually triggered (the automated email-check is on hold). Transforms the AE
    XML — pulled from the configured GCS bucket, where it is placed manually —
    into generation CSVs, diffs against last week's cached generation, and
    uploads the resulting delta to Symplectic. All artifacts are stored under
    /weekly/<year-week>/grant-feed/ in CasKFS.

    Uploads to Symplectic PROD by default; launch with a run tag
    symplectic_env=QA (e.g. `experts harvest dagster run-grant-feed-job
    --env QA`) to upload to QA instead.

    On completion (success or failure) a Slack notification is sent to the
    harvest-messages channel via `admin notify`.
    """
    env = context.dagster_run.tags.get("symplectic_env") or "PROD"
    try:
        result = exec(["experts", "harvest", "grant-feed", "process", "--env", env])
    except Exception as e:
        _notify_grant_feed(context, success=False, detail=str(e), env=env)
        raise

    result = result or {}
    grants = result.get("grants")
    uploaded = result.get("uploaded")
    context.add_output_metadata(metadata={"symplectic_env": env, **{k: v for k, v in result.items() if v is not None}})
    _notify_grant_feed(context, success=True, grants=grants, uploaded=uploaded, env=env)

    # Reporting is best-effort and never fails the ETL, but surface a failed
    # load to Slack so the reporting-DB gap doesn't go unnoticed.
    if result.get("reportingLoaded") is False:
        _slack_notify(
            context,
            "Grant feed reporting load failed",
            "The grant feed ETL succeeded, but loading the delta into the grant_feed "
            "reporting DB failed. Grants were still delivered to Symplectic; see run logs.",
            "warning",
        )
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="grant_feed",
)
def fetch_grant_feed_logs(context: AssetExecutionContext) -> None:
    """Daily: pull Symplectic import/delete logs and load the confirmation.

    Symplectic processes our upload ~1 day later, so this runs daily and keeps
    only the meaningful logs (see the fetch-logs CLI). Env follows the 
    deployment (dev -> QA, prod -> PROD).
    """
    symplectic_env = "QA" if context.dagster_run.tags.get("env") == "dev" else "PROD"
    result = exec(["experts", "harvest", "grant-feed", "fetch-logs", "--env", symplectic_env])
    if result:
        context.add_output_metadata(metadata={k: v for k, v in result.items() if v is not None})
    return None


def _notify_grant_feed(context, success: bool, grants=None, uploaded=None, detail=None, env=None) -> None:
    """Send the grant-feed completion notification to Slack via `admin notify`."""
    target = f"Symplectic {env}" if env else "Symplectic"
    if success:
        count = grants if grants is not None else "an unknown number of"
        title = "Grant feed ingest complete"
        if uploaded:
            message = f"Succeeded — {count} grants sent to {target}."
        else:
            message = f"Succeeded (upload skipped) — {count} grants in the delta."
        severity = "info"
    else:
        title = "Grant feed ingest FAILED"
        message = f"Grant feed ingest failed ({target}): {detail}"
        severity = "error"

    _slack_notify(context, title, message, severity)


def _slack_notify(context, title: str, message: str, severity: str) -> None:
    """Send a Slack notification via `admin notify`. Best-effort — never raises,
    so a notification problem can't mask the real ETL outcome."""
    try:
        exec(
            ["experts", "admin", "notify",
             "--title", title,
             "--message", message,
             "--severity", severity,
             "--source", "grant-feed"],
            no_json_parse=True
        )
    except Exception as notify_err:
        context.log.warning(f"Failed to send grant-feed Slack notification: {notify_err}")
