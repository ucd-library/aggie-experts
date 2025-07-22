from dagster import asset, DynamicOutput, AssetExecutionContext, AutoMaterializePolicy
import os
import hashlib
import json
import dagster as dg
import time
import subprocess

users_partitions = dg.DynamicPartitionsDefinition(name="users")

# condition = dg.AutomationCondition.eager().replace(
#     "newly_updated", dg.AutomationCondition.data_version_changed()
# )

# condition = dg.AutomationCondition.eager().replace(
#     "newly_updated", dg.AutomationCondition.data_version_changed()
# )


# # Wrap it with a rule using materialize_on (not decision_type)
# rule = dg.AutoMaterializeRule.materialize_on(condition)

# # Use a set of rules to build the policy
# custom_policy = automation_condition=(
#         AutomationCondition.on_cron("@daily") |
        
#     )

@dg.asset(
  partitions_def=users_partitions,
  code_version="1.0"
)
def extract_user(context) -> dg.MaterializeResult:
    user_id = context.partition_key

    subprocess.run(["experts", "harvest", "extract", user_id], check=True)

    return dg.MaterializeResult(metadata={"id": user_id})

@dg.asset(
    partitions_def=users_partitions,
    code_version="1.1",
    auto_materialize_policy=AutoMaterializePolicy.eager()
)
def transform_user(context: AssetExecutionContext, extract_user) -> dg.MaterializeResult:
    user_id = context.partition_key
    subprocess.run(["experts", "harvest", "transform", user_id], check=True)

    return dg.MaterializeResult(metadata={"id": user_id})


# Create a job that materializes both assets in the correct order
etl_users_job = dg.define_asset_job(
    name="etl_users_job",
    selection=dg.AssetSelection.assets(extract_user, transform_user)
)


@dg.sensor(
    job=etl_users_job, 
    minimum_interval_seconds=3600
)
def all_users_sensor(context: dg.SensorEvaluationContext):
    result = subprocess.run(["experts", "harvest", "list-users", "dev"], capture_output=True, text=True)
    output_lines = result.stdout.strip().split('\n')
    last_line = output_lines[-1] if output_lines else ""
    logInfo = json.loads(last_line)

    # Read JSON file if exists
    if os.path.exists(logInfo['cachePath']):
      with open(logInfo['cachePath'], "r") as f:
        user_ids = json.load(f)
        user_ids = user_ids.get("users", [])
    else:
      user_ids = []

    return dg.SensorResult(
        run_requests=[dg.RunRequest(partition_key=user) for user in user_ids],
        dynamic_partitions_requests=[users_partitions.build_add_request(user_ids)],
    )


defs = dg.Definitions(
    jobs=[etl_users_job],
    assets=[extract_user, transform_user],
    sensors=[all_users_sensor]
)