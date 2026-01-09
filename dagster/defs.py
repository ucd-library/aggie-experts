from dagster import (
  asset, DynamicOutput, AssetExecutionContext, AutoMaterializePolicy, Config, 
  FilesystemIOManager, run_status_sensor, DagsterRunStatus, RunStatusSensorContext,
  DailyPartitionsDefinition, StaticPartitionsDefinition, MultiPartitionsDefinition
)
import os
import sys
import hashlib
import json
import dagster as dg
import time
import subprocess
import signal
import atexit
from typing import Literal
from pydantic import Field

users_partitions = dg.DynamicPartitionsDefinition(name="users")
CODE_VERSION = "0.1"

# Define a config schema for the asset
class FetchUserListConfig(Config):
    group_id: Literal['experts', 'dev', 'sandbox'] = 'experts'  # Default value for group ID

class LoadUserConfig(Config):
    alias: Literal['stage', 'current', 'all'] = 'stage'  # Default alias/index for loading

class YearWeekConfig(Config):
    year_week: str = Field(..., description="Year-week for CaskFS purge in format YYYY-WW")

class SetAliasConfig(Config):
    year_week: str = Field(..., description="Year-week for CaskFS purge in format YYYY-WW")
    alias: Literal['stage', 'current']

class ReloadSearchTemplateConfig(Config):
  template: str = Field('complete', description="Search template name to load into Elasticsearch")

year_week_partitions = dg.DynamicPartitionsDefinition(name="year-week")
multi_partitions = MultiPartitionsDefinition(
    {
        "user": users_partitions,
        "year-week": year_week_partitions,
    }
)

def exec(cmd, check=True, capture_output=True, text=True):
    """Helper function to run a command and return the result."""
    print(f"Executing command: {' '.join(cmd)}")
    
    # result = subprocess.run(cmd, capture_output=capture_output, text=text)
    # print(result.stdout)  # Log output to console
    # if check and result.returncode != 0:
    #   print(result.stderr)
    #   raise subprocess.CalledProcessError(result.returncode, cmd, output=result.stdout, stderr=result.stderr)
    # output_lines = result.stdout.strip().split('\n')
    # last_line = output_lines[-1] if output_lines else ""
    
    process = subprocess.Popen(
      cmd,
      stdout=subprocess.PIPE,
      stderr=subprocess.STDOUT,  # Merge stderr into stdout for single-stream reading
      text=True,
      bufsize=1 # Line buffering
    )

    def _terminate_child():
      if process.poll() is None:
        try:
          os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
          pass

    # Ensure child is killed on normal interpreter shutdown
    atexit.register(_terminate_child)

    # Ensure child is killed on SIGINT/SIGTERM
    def _handle_term(signum, frame):
      _terminate_child()
      raise SystemExit(128 + signum)

    last_line = ""
    for line in process.stdout:
      sys.stdout.write(line)
      sys.stdout.flush()  # Ensure it prints immediately
      # You can also perform additional processing on the 'line' variable here
      last_line = line

    process.wait()

    if check and process.returncode != 0:
      raise subprocess.CalledProcessError(process.returncode, cmd)

    return json.loads(last_line)

@dg.asset(
  code_version=CODE_VERSION,
  group_name="init",
)
def fetch_user_list_from_cdl(context, config: FetchUserListConfig) -> None:
    """Get current user list from CDL and create dynamic partitions."""

    result = exec(["experts", "harvest", "dagster", "init-user-partitions", config.group_id])
  
    context.add_output_metadata(
      metadata={
        "group_id": config.group_id
      }
    )

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
  group_name="elasticsearch"
)
def ensure_current_indexes(context) -> None:
  """Ensure current week and next week indexes in ElasticSearch"""
  cmd = ["experts", "es", "ensure"]
  exec(cmd)
  return None

@dg.asset(
  code_version=CODE_VERSION,
  group_name="elasticsearch"
)
def set_alias(context, config: SetAliasConfig) -> None:
  """Set current/stage aliases to indexes in ElasticSearch"""
  cmd = ["experts", "es", "set-alias", config.alias, "--year-week", config.year_week]
  exec(cmd)
  return None

@dg.asset(
  code_version=CODE_VERSION,
  group_name="elasticsearch"
)
def delete_indexes(context, config: YearWeekConfig) -> None:
  """Delete unused year-week indexes in ElasticSearch"""
  cmd = ["experts", "es", "delete-index", "--year-week", config.year_week]
  exec(cmd)
  return None

@dg.asset(
  code_version=CODE_VERSION,
  group_name="elasticsearch"
)
def create_indexes(context, config: YearWeekConfig) -> None:
  """Manually create year-week indexes in ElasticSearch.  FYI, normally you use ensure_current_indexes asset."""
  cmd = ["experts", "es", "create-index", "--year-week", config.year_week]
  exec(cmd)
  return None

@dg.asset(
  code_version=CODE_VERSION,
  group_name="elasticsearch"
)
def get_current_es_state(context) -> None:
  """Prints all indexes and alias pointers in ElasticSearch"""
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

@dg.asset(
  code_version=CODE_VERSION,
  group_name="init",
)
def fetch_user_list_from_cdl(context, config: FetchUserListConfig) -> None:
    """Get current user list from CDL and create dynamic partitions."""

    result = exec(["experts", "harvest", "dagster", "init-user-partitions", config.group_id])
  
    context.add_output_metadata(
      metadata={
        "group_id": config.group_id
      }
    )

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

  cmd = ["experts", "harvest", "extract", user_id, "--reporting-job-id", run.run_id]

  metadata = {
    "user": user_id
  }

  result = exec(cmd)
  for file_info in result.get('files', []):
    metadata[file_info.get('assetPath')] = f'lastModified: {file_info.get("lastModified", "")}, updated: {not file_info.get("local_cache_write", False)}'

  context.add_output_metadata(
    metadata=metadata
  )

  context.set_data_version(
    asset_key=context.asset_key,
    data_version=dg.DataVersion("123456")
  )

  return None


@dg.asset(
    partitions_def=users_partitions,
    code_version=CODE_VERSION,
    auto_materialize_policy=AutoMaterializePolicy.eager(),
    deps=[extract_user],
    group_name="etl",
)
def transform_user_standard(context: AssetExecutionContext) -> None:
    """Transform user data into the  Aggie Experts Standard linked data format."""

    user_id = context.partition_key
    run = context.dagster_run

    exec(["experts", "harvest", "transform", "ae-std", user_id, "--reporting-job-id", run.run_id])

    context.add_output_metadata(
      metadata={
        "id": user_id
      }
    )

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

    context.add_output_metadata(
      metadata={
        "id": user_id
      }
    )

    return None

@dg.asset(
    partitions_def=users_partitions,
    code_version=CODE_VERSION,
    group_name="cleanup",
)
def purge_user_cask_files(context: AssetExecutionContext, config: YearWeekConfig) -> None:
    """Purge user files from CaskFS before."""
    user_id = context.partition_key
    run = context.dagster_run

    year_week = config.year_week
    if not year_week:
      raise ValueError("year_week must be provided in YearWeekConfig")

    result = exec(["cask", "rm", "-d", f"/weekly/{year_week}/{user_id}"])

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

    context.add_output_metadata(
      metadata=metadata
    )

    return None

# Create a job that materializes both assets in the correct order
etl_users_job = dg.define_asset_job(
    name="etl_users_job",
    description="Job to run the full ETL for a user: extract, transform (Aggie Experts Standard and Webapp), and load.  For realtime refreshes.",
    selection=dg.AssetSelection.assets(extract_user, transform_user_webapp, transform_user_standard, load_user),
)

extract_users_job = dg.define_asset_job(
    name="extract_users_job",
    description="Job to run extract a user and first transform Aggie Experts Standard Transform.",
    selection=dg.AssetSelection.assets(extract_user, transform_user_standard)
)

transform_load_users_job = dg.define_asset_job(
    name="transform_load_users_job",
    description="Job to run the second Webapp Transform (requires all users) and load user after extraction.",
    selection=dg.AssetSelection.assets(transform_user_webapp, load_user)
)

reload_search_template_job = dg.define_asset_job(
  name="reload_search_template_job",
  description="Reload the Elasticsearch search template.",
  selection=dg.AssetSelection.assets(reload_search_template)
)

@run_status_sensor(run_status=DagsterRunStatus.SUCCESS, monitored_jobs=[etl_users_job])
def success_sensor(context: RunStatusSensorContext):
    run = context.dagster_run
    message = f"✅ Dagster job `{run.job_name}` succeeded! Run ID: {run.run_id}"
    
    # Example: Print, or replace with logic to send email/Slack/etc.
    context.log.info(message)

# @dg.sensor(
#     job=etl_users_job, 
#     minimum_interval_seconds=3600
# )
# def sandbox_users_sensor(context: dg.SensorEvaluationContext):
#     user_ids = loadUserGroup("sandbox")

#     return dg.SensorResult(
#         run_requests=[dg.RunRequest(partition_key=user) for user in user_ids],
#         dynamic_partitions_requests=[users_partitions.build_add_request(user_ids)],
#     )

defs = dg.Definitions(
    jobs=[etl_users_job, extract_users_job, transform_load_users_job, reload_search_template_job],
    assets=[extract_user, transform_user_webapp, transform_user_standard, 
        load_user, init_databases, fetch_user_list_from_cdl,
        purge_user_cask_files, ensure_current_indexes, set_alias,
        create_indexes, delete_indexes, get_current_es_state,
        reload_search_template],
    sensors=[success_sensor],
    resources={}
)