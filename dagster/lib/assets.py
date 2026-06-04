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
    NotifyConfig,
    SetAliasConfig,
    ReloadSearchTemplateConfig,
    UpdateScholarlyRecordConfig,
    UpdateScholarlyRecordCdlConfig,
    UpdateExpertConfig,
    UpdateExpertCdlConfig,
    UpdateExpertAvailabilityConfig,
    UpdateExpertAvailabilityCdlConfig,
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
# Admin update assets
# ---------------------------------------------------------------------------

@dg.asset(
    code_version=CODE_VERSION,
    group_name="admin_updates",
)
def update_scholarly_record_es(context: AssetExecutionContext, config: UpdateScholarlyRecordConfig) -> None:
    """Update a work or grant record in Elasticsearch."""
    cmd = [
        "experts", "admin", "update", "scholarly-record",
        config.expert_id, config.relationship_id,
        "--type", config.type,
        "--elasticsearch", "yes",
        "--cdl", "no",
    ]
    if config.visibility is not None:
        cmd += ["--visibility", config.visibility]
    if config.favorite is not None:
        cmd += ["--favorite", config.favorite]
    if config.reject is not None:
        cmd += ["--reject", config.reject]

    result = exec(cmd)
    context.add_output_metadata(metadata={
        "expert_id": config.expert_id,
        "relationship_id": config.relationship_id,
        "type": config.type,
        "status": result.get("status"),
    })
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="admin_updates",
)
def update_scholarly_record_cdl(context: AssetExecutionContext, config: UpdateScholarlyRecordCdlConfig) -> None:
    """Propagate a work or grant record update to CDL/Elements."""
    if not config.cdl_enabled:
        context.log.info(f"Skipping CDL update for {config.expert_id} (CDL propagation disabled)")
        context.add_output_metadata(metadata={"expert_id": config.expert_id, "status": "skipped"})
        return None

    cmd = [
        "experts", "admin", "update", "scholarly-record",
        config.expert_id, config.relationship_id,
        "--type", config.type,
        "--elasticsearch", "no",
        "--cdl", "yes",
    ]
    if config.visibility is not None:
        cmd += ["--visibility", config.visibility]
    if config.favorite is not None:
        cmd += ["--favorite", config.favorite]
    if config.reject is not None:
        cmd += ["--reject", config.reject]

    result = exec(cmd)
    context.add_output_metadata(metadata={
        "expert_id": config.expert_id,
        "relationship_id": config.relationship_id,
        "type": config.type,
        "status": result.get("status"),
    })
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="admin_updates",
)
def update_expert_es(context: AssetExecutionContext, config: UpdateExpertConfig) -> None:
    """Update or delete an expert record in Elasticsearch."""
    cmd = [
        "experts", "admin", "update", "expert",
        config.expert_id,
        "--elasticsearch", "yes",
        "--cdl", "no",
    ]
    if config.visibility is not None:
        cmd += ["--visibility", config.visibility]
    if config.delete is not None:
        cmd += ["--delete", config.delete]

    result = exec(cmd)
    context.add_output_metadata(metadata={
        "expert_id": config.expert_id,
        "status": result.get("status"),
        "deleted": result.get("deleted", False),
    })
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="admin_updates",
)
def update_expert_cdl(context: AssetExecutionContext, config: UpdateExpertCdlConfig) -> None:
    """Propagate an expert record update to CDL/Elements."""
    if not config.cdl_enabled:
        context.log.info(f"Skipping CDL update for {config.expert_id} (CDL propagation disabled)")
        context.add_output_metadata(metadata={"expert_id": config.expert_id, "status": "skipped"})
        return None

    cmd = [
        "experts", "admin", "update", "expert",
        config.expert_id,
        "--elasticsearch", "no",
        "--cdl", "yes",
    ]
    if config.visibility is not None:
        cmd += ["--visibility", config.visibility]
    if config.delete is not None:
        cmd += ["--delete", config.delete]

    result = exec(cmd)
    context.add_output_metadata(metadata={
        "expert_id": config.expert_id,
        "status": result.get("status"),
        "deleted": result.get("deleted", False),
    })
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="admin_updates",
)
def update_expert_availability_es(context: AssetExecutionContext, config: UpdateExpertAvailabilityConfig) -> None:
    """Update expert availability labels in Elasticsearch."""
    import json
    cmd = [
        "experts", "admin", "update", "expert-availability",
        config.expert_id,
        "--elasticsearch", "yes",
        "--cdl", "no",
        "--labels-to-add", json.dumps(config.labels_to_add),
        "--labels-to-remove", json.dumps(config.labels_to_remove),
        "--current-labels", json.dumps(config.current_labels),
    ]

    result = exec(cmd)
    context.add_output_metadata(metadata={
        "expert_id": config.expert_id,
        "status": result.get("status"),
    })
    return None


@dg.asset(
    code_version=CODE_VERSION,
    group_name="admin_updates",
)
def update_expert_availability_cdl(context: AssetExecutionContext, config: UpdateExpertAvailabilityCdlConfig) -> None:
    """Propagate expert availability label updates to CDL/Elements."""
    if not config.cdl_enabled:
        context.log.info(f"Skipping CDL update for {config.expert_id} (CDL propagation disabled)")
        context.add_output_metadata(metadata={"expert_id": config.expert_id, "status": "skipped"})
        return None

    import json
    cmd = [
        "experts", "admin", "update", "expert-availability",
        config.expert_id,
        "--elasticsearch", "no",
        "--cdl", "yes",
        "--labels-to-add", json.dumps(config.labels_to_add),
        "--labels-to-remove", json.dumps(config.labels_to_remove),
        "--current-labels", json.dumps(config.current_labels),
    ]

    result = exec(cmd)
    context.add_output_metadata(metadata={
        "expert_id": config.expert_id,
        "status": result.get("status"),
    })
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
