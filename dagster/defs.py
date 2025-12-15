from dagster import asset, DynamicOutput, AssetExecutionContext, AutoMaterializePolicy, Config, FilesystemIOManager, run_status_sensor, DagsterRunStatus, RunStatusSensorContext
import os
import sys
import hashlib
import json
import dagster as dg
import time
import subprocess
from typing import Literal

users_partitions = dg.DynamicPartitionsDefinition(name="users")

# Define a config schema for the asset
class FetchUserListConfig(Config):
    group_id: Literal['experts', 'dev', 'sandbox'] = 'experts'  # Default value for group ID

class LoadUserConfig(Config):
    alias: Literal['stage', 'current', 'all'] = 'stage'  # Default alias/index for loading

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
  code_version="1.0"
)
def init_databases(context) -> None:
  """Initialize PostgreSQL schema and current weeks ElasticSearch Indexes."""
  cmd = ["experts", "init"]
  exec(cmd)
  return None

@dg.asset(
  code_version="1.0"
)
def fetch_user_list_from_cdl(context, config: FetchUserListConfig) -> None:
    """Get current user list from CDL and create dynamic partitions."""

    result = exec(["experts", "harvest", "dagster", "init-partitions", config.group_id])
  
    context.add_output_metadata(
      metadata={
        "group_id": config.group_id
      }
    )

@dg.asset(
  partitions_def=users_partitions,
  code_version="1.0",
  deps=[init_databases]
)
def extract_user(context) -> None:
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
    code_version="1.1",
    auto_materialize_policy=AutoMaterializePolicy.eager(),
    deps=[extract_user]
)
def transform_user_standard(context: AssetExecutionContext) -> None:
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
    code_version="1.1",
    auto_materialize_policy=AutoMaterializePolicy.eager(),
    deps=[transform_user_standard]
)
def transform_user_webapp(context: AssetExecutionContext) -> None:
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
    code_version="1.1",
    auto_materialize_policy=AutoMaterializePolicy.eager(),
    deps=[transform_user_webapp]
)
def load_user(context: AssetExecutionContext, config: LoadUserConfig) -> None:
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
    selection=dg.AssetSelection.assets(extract_user, transform_user_webapp, transform_user_standard, load_user)
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
    jobs=[etl_users_job, extract_users_job, transform_load_users_job],
    assets=[extract_user, transform_user_webapp, transform_user_standard, 
            load_user, init_databases, fetch_user_list_from_cdl],
    sensors=[success_sensor],
    resources={
        "io_manager": FilesystemIOManager(base_dir="/opt/dagster/dagster_home/storage")
    }
)