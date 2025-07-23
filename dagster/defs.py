from dagster import asset, DynamicOutput, AssetExecutionContext, AutoMaterializePolicy, Config, FilesystemIOManager
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

def exec(cmd, check=True, capture_output=True, text=True):
    """Helper function to run a command and return the result."""
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
# def extract_user(context, config: ExtractUserConfig) -> dg.MaterializeResult:
def extract_user(context, config: ExtractUserConfig) -> None:
  user_id = context.partition_key

  # Read force flag from config if provided, else default to True
  force_flag = config.force

  cmd = ["experts", "harvest", "extract", user_id]
  if force_flag:
    cmd.append("--force")

  metadata = {
    "user": user_id,
    "force": force_flag
  }

  result = exec(cmd)
  for file_info in result.get('files', []):
    metadata[file_info.get('assetPath')] = f'lastModified: {file_info.get("lastModified", "")}, updated: {not file_info.get("noOp", False)}'

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
def transform_user(context: AssetExecutionContext) -> None:
    user_id = context.partition_key
    subprocess.run(["experts", "harvest", "transform", user_id], check=True)

    context.add_output_metadata(
      metadata={
        "id": user_id
      }
    )


# Create a job that materializes both assets in the correct order
etl_users_job = dg.define_asset_job(
    name="etl_users_job",
    selection=dg.AssetSelection.assets(extract_user, transform_user)
)


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
    jobs=[etl_users_job],
    assets=[extract_user, transform_user],
    sensors=[dev_users_sensor, sandbox_users_sensor],
    resources={
        "io_manager": FilesystemIOManager(base_dir="/opt/dagster/dagster_home/storage")
    }
)