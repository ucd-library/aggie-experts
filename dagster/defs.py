from dagster import asset, DynamicOutput, AssetExecutionContext, AutoMaterializePolicy, Config, FilesystemIOManager, run_status_sensor, DagsterRunStatus, RunStatusSensorContext
import os
import hashlib
import json
import dagster as dg
import time
import subprocess

users_partitions = dg.DynamicPartitionsDefinition(name="users")

# Define a config schema for the asset
class ExtractUserConfig(Config):
    force: bool = True  # Default value for force flag

class LoadUserConfig(Config):
    alias: str = "stage"  # Default alias for loading

def exec(cmd, check=True, capture_output=True, text=True):
    """Helper function to run a command and return the result."""
    print(f"Executing command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=capture_output, text=text)
    print(result.stdout)  # Log output to console
    if check and result.returncode != 0:
      print(result.stderr)
      raise subprocess.CalledProcessError(result.returncode, cmd, output=result.stdout, stderr=result.stderr)
    output_lines = result.stdout.strip().split('\n')
    last_line = output_lines[-1] if output_lines else ""
    return json.loads(last_line)

@dg.asset(
  partitions_def=users_partitions,
  code_version="1.0"
)
def extract_user(context, config: ExtractUserConfig) -> None:
# def extract_user(context, config: ExtractUserConfig) -> None:
  user_id = context.partition_key
  run = context.dagster_run

  cmd = ["experts", "harvest", "extract", user_id, "--enable-gcs-cache", "--reporting-job-id", run.run_id]

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
    code_version="1.1"
)
def pull_gcs_user_cache(context: AssetExecutionContext) -> None:
    user_id = context.partition_key
    run = context.dagster_run

    exec(["experts", "harvest", "cache", "pull", user_id, "--reporting-job-id", run.run_id])

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
    deps=[extract_user]
)
def transform_user(context: AssetExecutionContext) -> None:
    user_id = context.partition_key
    run = context.dagster_run

    exec(["experts", "harvest", "transform", user_id, "--enable-gcs-cache", "--reporting-job-id", run.run_id])

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
    deps=[pull_gcs_user_cache]
)
def transform_gcs_cache_user(context: AssetExecutionContext) -> None:
    user_id = context.partition_key
    run = context.dagster_run

    exec(["experts", "harvest", "transform", user_id, "--enable-gcs-cache", "--reporting-job-id", run.run_id])

    context.add_output_metadata(
      metadata={
        "id": user_id,
        "cache": "gcs"
      }
    )

    return None

@dg.asset(
    partitions_def=users_partitions,
    code_version="1.1",
    auto_materialize_policy=AutoMaterializePolicy.eager(),
    deps=[transform_user]
)
def load_user(context: AssetExecutionContext, config: LoadUserConfig) -> None:
    user_id = context.partition_key
    run = context.dagster_run

    exec(["experts", "harvest", "load", user_id, "--reporting-job-id", run.run_id, "--alias", config.alias])

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
    deps=[transform_gcs_cache_user]
)
def load_gcs_cache_user(context: AssetExecutionContext) -> None:
    user_id = context.partition_key
    run = context.dagster_run

    exec(["experts", "harvest", "load", user_id, "--reporting-job-id", run.run_id])

    context.add_output_metadata(
      metadata={
        "id": user_id,
        "cache": "gcs"
      }
    )

    return None

@dg.asset(
    partitions_def=users_partitions,
    code_version="1.1"
)
def push_gcs_user_cache(context: AssetExecutionContext) -> None:
    user_id = context.partition_key
    run = context.dagster_run

    exec(["experts", "harvest", "cache", "push", user_id, "--reporting-job-id", run.run_id])

    context.add_output_metadata(
      metadata={
        "id": user_id
      }
    )

    return None


# Create a job that materializes both assets in the correct order
etl_users_job = dg.define_asset_job(
    name="etl_users_job",
    selection=dg.AssetSelection.assets(extract_user, transform_user, load_user)
)

gcs_etl_users_job = dg.define_asset_job(
    name="gcs_etl_users_job",
    selection=dg.AssetSelection.assets(pull_gcs_user_cache, transform_gcs_cache_user, load_gcs_cache_user)
)

@run_status_sensor(run_status=DagsterRunStatus.SUCCESS, monitored_jobs=[etl_users_job])
def success_sensor(context: RunStatusSensorContext):
    run = context.dagster_run
    message = f"✅ Dagster job `{run.job_name}` succeeded! Run ID: {run.run_id}"
    
    # Example: Print, or replace with logic to send email/Slack/etc.
    context.log.info(message)

@dg.sensor(
    job=etl_users_job, 
    minimum_interval_seconds=3600
)
def dev_users_sensor(context: dg.SensorEvaluationContext):
    user_ids = loadUserGroup("dev")

    return dg.SensorResult(
        run_requests=[dg.RunRequest(partition_key=user) for user in user_ids],
        dynamic_partitions_requests=[users_partitions.build_add_request(user_ids)],
    )

@dg.sensor(
    job=etl_users_job, 
    minimum_interval_seconds=3600
)
def sandbox_users_sensor(context: dg.SensorEvaluationContext):
    user_ids = loadUserGroup("sandbox")

    return dg.SensorResult(
        run_requests=[dg.RunRequest(partition_key=user) for user in user_ids],
        dynamic_partitions_requests=[users_partitions.build_add_request(user_ids)],
    )

def loadUserGroup(groupId):
    """Load user group from CDL."""
    result = exec(["experts", "harvest", "list", "users", groupId])

    # Read JSON file if exists
    rpath = result.get('cachePath', {}).get('assetPath', '')
    if os.path.exists(rpath):
      with open(rpath, "r") as f:
        user_ids = json.load(f)
        user_ids = user_ids.get("users", [])
    else:
      user_ids = []

    return user_ids

defs = dg.Definitions(
    jobs=[etl_users_job, gcs_etl_users_job],
    assets=[
            extract_user, transform_user, load_user, 
            pull_gcs_user_cache, push_gcs_user_cache, transform_gcs_cache_user, load_gcs_cache_user],
    sensors=[dev_users_sensor, sandbox_users_sensor, success_sensor],
    resources={
        "io_manager": FilesystemIOManager(base_dir="/opt/dagster/dagster_home/storage")
    }
)