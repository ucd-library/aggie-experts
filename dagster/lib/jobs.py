"""
Dagster job definitions for the Aggie Experts ETL pipeline.
"""
import dagster as dg

from .assets import (
    extract_user,
    transform_user_standard,
    transform_user_webapp,
    load_user,
    init_databases,
    fetch_user_list_from_cdl,
    ensure_current_index,
    exec_weekly_etl,
    purge_dagster_runs,
    purge_reporting_db,
    purge_year_week_cask_files,
    update_scholarly_record_es,
    update_scholarly_record_cdl,
    update_expert_es,
    update_expert_cdl,
    update_expert_availability_es,
    update_expert_availability_cdl,
)


# ---------------------------------------------------------------------------
# Job definitions
# ---------------------------------------------------------------------------

etl_users_job = dg.define_asset_job(
    name="etl_users_job",
    description="Job to run the full ETL for a user: extract, transform (Aggie Experts Standard and Webapp), and load.  For realtime refreshes.",
    selection=dg.AssetSelection.assets(extract_user, transform_user_webapp, transform_user_standard, load_user),
    tags={
        "dagster/priority": "2",
        "dagster/max_runtime": str(40 * 60)  # 40 minute max runtime
    }
)

start_weekly_etl_job = dg.define_asset_job(
    name="start_weekly_etl_job",
    description="Job to run init the new es index, harvest the new user list, kick of the extract_users_job for all users via dynamic partitions.",
    selection=dg.AssetSelection.assets(ensure_current_index, fetch_user_list_from_cdl, exec_weekly_etl),
    tags={"dagster/priority": "3"}
)

extract_users_job = dg.define_asset_job(
    name="extract_users_job",
    description="Job to run extract a user and first transform Aggie Experts Standard Transform.",
    selection=dg.AssetSelection.assets(extract_user, transform_user_standard),
    tags={
        "dagster/priority": "-1",
        "dagster/max_runtime": str(30 * 60)  # 30 minute max runtime
    }
)

transform_load_users_job = dg.define_asset_job(
    name="transform_load_users_job",
    description="Job to run the second Webapp Transform (requires all users) and load user after extraction.",
    selection=dg.AssetSelection.assets(transform_user_webapp, load_user),
    tags={"dagster/priority": "-1"}
)

update_scholarly_record_job = dg.define_asset_job(
    name="update_scholarly_record_job",
    description="Update a work or grant record in Elasticsearch and CDL/Elements (two parallel steps).",
    selection=dg.AssetSelection.assets(update_scholarly_record_es, update_scholarly_record_cdl),
    tags={"dagster/priority": "1"},
)

update_expert_job = dg.define_asset_job(
    name="update_expert_job",
    description="Update or delete an expert record in Elasticsearch and CDL/Elements (two parallel steps).",
    selection=dg.AssetSelection.assets(update_expert_es, update_expert_cdl),
    tags={"dagster/priority": "1"},
)

update_expert_availability_job = dg.define_asset_job(
    name="update_expert_availability_job",
    description="Update expert availability labels in Elasticsearch and CDL/Elements (two parallel steps).",
    selection=dg.AssetSelection.assets(update_expert_availability_es, update_expert_availability_cdl),
    tags={"dagster/priority": "1"},
)

cleanup_job = dg.define_asset_job(
    name="cleanup",
    description="Job to cleanup; old reporting data (commands 8 weeks, users 6 months), old CaskFS files (weekly harvest from 4 weeks ago), and old Dagster runs (older than 8 weeks).",
    selection=dg.AssetSelection.assets(purge_dagster_runs, purge_reporting_db, purge_year_week_cask_files),
    tags={
        "dagster/priority": "-1",
        "dagster/max_runtime": str(60 * 60 * 2)  # 2 hour max runtime
    }
)
