from dagster import (
  asset, DynamicOutput, AssetExecutionContext, AutoMaterializePolicy, Config, 
  FilesystemIOManager, run_status_sensor, DagsterRunStatus, RunStatusSensorContext,
  DailyPartitionsDefinition, StaticPartitionsDefinition, MultiPartitionsDefinition, RetryPolicy
)
from dagster_celery import celery_executor
import os
import sys
import hashlib
import json
import dagster as dg
import requests
import time
import subprocess
import signal
import atexit
from typing import Literal
from pydantic import Field
import psycopg2

users_partitions = dg.DynamicPartitionsDefinition(name="users")
CODE_VERSION = "0.1"

conn = psycopg2.connect(
  host=os.getenv('DAGSTER_POSTGRES_HOST', 'localhost'),
  database=os.getenv('DAGSTER_POSTGRES_DB', 'dagster'),
  user=os.getenv('DAGSTER_POSTGRES_USER', 'postgres'),
  password=os.getenv('DAGSTER_POSTGRES_PASSWORD', 'postgres')
)
BACKFILL_STATUS_TABLE = "anduin.backfill_status"
BACKFILL_UPDATE_FN = "anduin.set_backfill_finished"
GET_ACTIVE_BACKFILL_FN = "ae.get_active_backfill_ids"

TERMINAL = {
    dg.DagsterRunStatus.SUCCESS,
    dg.DagsterRunStatus.FAILURE,
    dg.DagsterRunStatus.CANCELED,
}

NON_TERMINAL = [
  dg.DagsterRunStatus.QUEUED,
  dg.DagsterRunStatus.NOT_STARTED,
  dg.DagsterRunStatus.STARTING,
  dg.DagsterRunStatus.STARTED,
  dg.DagsterRunStatus.CANCELING,
]

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

def exec(cmd, check=True, capture_output=True, text=True, stdin_data=None, no_json_parse=False):
    """Helper function to run a command and return the result."""
    print(f"Executing command: {' '.join(cmd)}")
    
    process = subprocess.Popen(
      cmd,
      stdout=subprocess.PIPE,
      stderr=subprocess.STDOUT,  # Merge stderr into stdout for single-stream reading
      stdin=subprocess.PIPE if stdin_data is not None else None,
      text=True,
      bufsize=1, # Line buffering
      start_new_session=True
    )

    if stdin_data is not None:
      process.stdin.write(stdin_data)
      process.stdin.close()

    def terminate_child():
      if process.poll() is None:
        try:
          # kill the whole group
          os.killpg(process.pid, signal.SIGTERM)
        except Exception:
          # fall back to terminating the single process
          try:
            process.terminate()
          except Exception:
            pass

    cleanup_handler = terminate_child
    atexit.register(cleanup_handler)

    try:
      last_line = ""
      # output_lines = []

      assert process.stdout is not None
      for line in process.stdout:
        # log/stream immediately
        sys.stdout.write(line)
        sys.stdout.flush()
        # log_line(line.rstrip("\n"))

        # output_lines.append(line)
        last_line = line

      rc = process.wait()

      if check and rc != 0:
        raise subprocess.CalledProcessError(rc, cmd, output="")

      if no_json_parse:
        return None

      # if you expect JSON on the last line:
      return json.loads(last_line)
    finally:
      atexit.unregister(cleanup_handler)
      if process.stdout:
          process.stdout.close()

@dg.asset(
  code_version=CODE_VERSION,
  group_name="init"
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
def ensure_current_index(context) -> None:
  """Ensure current week index in ElasticSearch.  Set stage to this week"""
  cmd = ["experts", "es", "ensure"]
  exec(cmd)

  cmd = ["experts", "es", "set-alias", "stage", "--current"]
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
  """Manually create year-week indexes in ElasticSearch.  FYI, normally you use ensure_current_index asset."""
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
  return None

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
  if result.get('filesCount'):
    metadata["file_count"] = result.get('filesCount')

  context.add_output_metadata(
    metadata=metadata
  )

  # context.set_data_version(
  #   asset_key=context.asset_key,
  #   data_version=dg.DataVersion("123456")
  # )

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
    code_version=CODE_VERSION,
    group_name="etl",
    retry_policy=RetryPolicy(
        max_retries=0
    )
)
def exec_weekly_etl(context: AssetExecutionContext) -> None:
    """Start the full weekly ETL process for all users."""

    exec(["experts", "harvest", "dagster", "run-extract-users-job", "--notify", "true", "--continue-etl", "true"], no_json_parse=True)

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
    tags={"dagster/priority": "2"}
)

init_weekly_etl = dg.define_asset_job(
    name="init_weekly_etl",
    description="Job to run init the new es index and harvest the new user list.",
    selection=dg.AssetSelection.assets(ensure_current_index, fetch_user_list_from_cdl),
    tags={"dagster/priority": "3"}
)

extract_users_job = dg.define_asset_job(
    name="extract_users_job",
    description="Job to run extract a user and first transform Aggie Experts Standard Transform.",
    selection=dg.AssetSelection.assets(extract_user, transform_user_standard),
    tags={"dagster/priority": "-1"}
)

transform_load_users_job = dg.define_asset_job(
    name="transform_load_users_job",
    description="Job to run the second Webapp Transform (requires all users) and load user after extraction.",
    selection=dg.AssetSelection.assets(transform_user_webapp, load_user),
    tags={"dagster/priority": "-1"}
)

def send_slack_notification(context, backfill_id: str, status: str, message: str):
    """Send a Slack notification about backfill completion via webhook."""
    webhook_url = os.getenv('SLACK_WEBHOOK_URL')
    app_url = os.getenv('APP_URL', 'http://localhost:4000')
    
    if not webhook_url:
        context.log.warning(f"Warning: SLACK_WEBHOOK_URL not set, skipping Slack notification")
        return
    
    try:
        response = requests.post(
            webhook_url,
            json={"text": f"\n{message}\nBackfill ID: `{backfill_id}`\n<{app_url}/dagster/runs/b/{backfill_id}|View Backfill Details on {app_url}>"},
            timeout=5
        )
        response.raise_for_status()
    except Exception as e:
        context.log.error(f"Error sending Slack notification: {e}")

# def _cursor_state(context: dg.RunStatusSensorContext) -> dict:
#     return json.loads(context.cursor) if context.cursor else {"notified_backfills": []}

@dg.sensor(
  description="Sensor to notify when a backfill is complete and optionally continue the ETL process, executing transform_load_users_job on complete of extract_users_job.",
  minimum_interval_seconds=60 # Check every 60 seconds
)
def etl_notify_and_continue(context: dg.SensorEvaluationContext):
    # first get all new started runs and make sure they are in the backfill_status table
    with conn.cursor() as cur:
        cur.execute(
            f""" SELECT DISTINCT r.backfill_id
                FROM public.runs r
                WHERE create_timestamp > NOW() - INTERVAL '5 minutes'
                  AND r.backfill_id IS NOT NULL;"""
        )
        conn_result = cur.fetchall()
        if conn_result:
          backfill_ids = [row[0] for row in conn_result]
          for backfill_id in backfill_ids:
            cur.execute(
                f"""
                INSERT INTO {BACKFILL_STATUS_TABLE} (backfill_id)
                VALUES (%s)
                ON CONFLICT (backfill_id) DO NOTHING;
                """,
                (backfill_id,)
            )
          conn.commit()

    # Now get all backfills that are still running
    with conn.cursor() as cur:
        cur.execute(
            f""" SELECT DISTINCT backfill_id
                FROM {BACKFILL_STATUS_TABLE} 
                WHERE status = 'RUNNING';
                """
        )
        conn_result = cur.fetchall()
        if not conn_result:
          return dg.SkipReason("No active backfills found.")
        backfill_ids = [row[0] for row in conn_result]

        for backfill_id in backfill_ids:
          cur.execute(
              f"""SELECT ae.is_active(%s) as is_active;""",
              (backfill_id,)
          )
          result = cur.fetchone()
          if result:
            is_active = result[0]
            if is_active:
              context.log.info(f"Backfill {backfill_id} is still active. ignoring.")
              backfill_ids.remove(backfill_id)
          else:
            context.log.warning(
              f"""No result from is_active function for backfill {backfill_id}.  Assuming active."""
            )

    if len(backfill_ids) == 0:
      return dg.SkipReason("No completed backfills found.")

    
    context.log.info(f"Completed backfills found: {backfill_ids}")

    with conn.cursor() as cur:
      for backfill_id in backfill_ids:
        cur.execute(
          f"""SELECT pipeline_name, run_body::JSON->'tags' as tags
            FROM runs
            WHERE backfill_id = %s
            LIMIT 1;
          """,
          (backfill_id,)
        )
        result = cur.fetchone()
        if not result:
          context.log.warning(f"No runs found for backfill {backfill_id}, skipping.")
          continue

        pipeline_name, tags = result
        job_name = pipeline_name
        notify = tags.get("notify")
        continue_etl = tags.get("continue_etl")

        cur.execute(
          f"""
          SELECT {BACKFILL_UPDATE_FN}(%s) as updated;
          """,
          (backfill_id,)
        )
        result = cur.fetchone()
        if result:
            updated = result[0]
            if not updated:
                context.log.warning(f"Sensor already processed completed backfill {backfill_id}")
                continue
        conn.commit()

        # Query all runs that belong to this backfill (by tag)
        run_records = context.instance.get_run_records(
            filters=dg.RunsFilter(tags={"dagster/backfill": backfill_id})
        )
        statuses = [r.dagster_run.status for r in run_records]
        partitions = [r.dagster_run.tags.get("dagster/partition") for r in run_records]

        if notify == "true":
          _notify_backfill_completion(context, backfill_id, statuses=statuses)

        if continue_etl == "true" and job_name == "extract_users_job":
          runs = []
          context.log.info(f"Triggering transform_load_users_job for backfill {backfill_id}. {len(partitions)} partitions found.")
          stdin_data = ",".join(partitions)
          try:
              exec(["experts", "harvest", "dagster", "run-transform-load-users-job", "--notify", "true", "--partition-keys", "."], stdin_data=stdin_data, no_json_parse=True)
          except Exception as e:
              context.log.error(f"Error triggering transform_load_users_job for backfill {backfill_id}: {e}")
              raise e
          context.log.info(f"Executed backfill via cli.")
        else:
          context.log.info(f"No not a extract_users_job or continue_etl is not true for backfill {backfill_id}, skipping triggering next job.")

def _notify_backfill_completion(context: dg.RunStatusSensorContext, backfill_id: str, statuses: list = None):
  with conn.cursor() as cur:
    cur.execute(
        f"SELECT status, notified FROM {BACKFILL_STATUS_TABLE} WHERE backfill_id = %s;",
        (backfill_id,)
    )
    conn_result = cur.fetchone()
    if conn_result:
        status, notified = conn_result
        if notified:
            return dg.SkipReason(f"Already notified for backfill {backfill_id}")

    cur.execute(
      f"""
      UPDATE {BACKFILL_STATUS_TABLE}
      SET notified = TRUE
      WHERE backfill_id = %s;
      """,
      (backfill_id,)
    )
    conn.commit()

  # get counts for each status
  status_counts = {status.value: statuses.count(status) for status in set(statuses)}
  
  if any(s != dg.DagsterRunStatus.SUCCESS for s in statuses):
    # send a "backfill finished with issues" notification
    context.log.info(f"Backfill {backfill_id} completed with issues.")
    send_slack_notification(context, backfill_id, "failure", f"Backfill {backfill_id} completed *with issues.*\nStatus counts: {status_counts}")
  else:
    context.log.info(f"Backfill {backfill_id} completed successfully.")
    # send a "backfill completed successfully" notification
    send_slack_notification(context, backfill_id, "success", f"Backfill {backfill_id} completed *successfully.*\nStatus counts: {status_counts}")
@dg.run_status_sensor(
  description="Sensor to notify when a backfill is complete and optionally continue the ETL process, executing transform_load_users_job on complete of extract_users_job.",
  run_status=dg.DagsterRunStatus.SUCCESS,
  monitored_jobs=[extract_users_job, transform_load_users_job],
  minimum_interval_seconds=2 # Check every 2 seconds
)
def full_etl_notify_and_continue(context: dg.RunStatusSensorContext):
    backfill_id = context.dagster_run.tags.get("dagster/backfill")
    if not backfill_id:
        return dg.SkipReason("Completed run is not part of a backfill, skipping.")

    notify = context.dagster_run.tags.get("notify")
    continue_etl = context.dagster_run.tags.get("continue_etl")
    job_name = context.dagster_run.job_name

    # state = _cursor_state(context)
    # if backfill_id in state["notified_backfills"]:
    #     return dg.SkipReason(f"Already notified for backfill {backfill_id}")

    # Get all runs with NON_TERMINAL status
    all_in_flight_runs = context.instance.get_run_records(
        dg.RunsFilter(
            statuses=NON_TERMINAL,
        )
    )

    # Group by backfill_id and keep one run per backfill
    active_backfills = {}
    for run_record in all_in_flight_runs:
        run_backfill_id = run_record.dagster_run.tags.get("dagster/backfill")
        if run_backfill_id and run_backfill_id not in active_backfills:
            active_backfills[run_backfill_id] = run_record

    # Check if current backfill is still in flight
    if backfill_id in active_backfills:
        return dg.SkipReason(f"Backfill {backfill_id} still running") 

    with conn.cursor() as cur:
        cur.execute(
            f"SELECT status, notified FROM {BACKFILL_STATUS_TABLE} WHERE backfill_id = %s;",
            (backfill_id,)
        )
        conn_result = cur.fetchone()
        if conn_result:
            status, notified = conn_result
            if notified:
                return dg.SkipReason(f"Already notified for backfill {backfill_id}")
        else:
            cur.execute(
                f"""
                INSERT INTO {BACKFILL_STATUS_TABLE} (backfill_id)
                VALUES (%s)
                ON CONFLICT (backfill_id) DO NOTHING;
                """,
                (backfill_id,)
            )
            conn.commit()           

    # Mark backfill has finished in the database
    # This has a row lock to prevent double notifications
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT {BACKFILL_UPDATE_FN}(%s) as updated;
            """,
            (backfill_id,)
        )
        result = cur.fetchone()
        if result:
            updated = result[0]
            if not updated:
                context.log.warning(f"Backfill {backfill_id} was already marked as notified in the database.")
                return dg.SkipReason(f"Already notified for backfill {backfill_id}")
        conn.commit()

    # Query all runs that belong to this backfill (by tag)
    run_records = context.instance.get_run_records(
        filters=dg.RunsFilter(tags={"dagster/backfill": backfill_id})
    )
    statuses = [r.dagster_run.status for r in run_records]
    partitions = [r.dagster_run.tags.get("dagster/partition") for r in run_records]

    # get counts for each status
    status_counts = {status.value: statuses.count(status) for status in set(statuses)}
    
    if any(s != dg.DagsterRunStatus.SUCCESS for s in statuses):
        # send a "backfill finished with issues" notification
        context.log.info(f"Backfill {backfill_id} completed with issues.")
        if notify == "true":
            send_slack_notification(backfill_id, "failure", f"Backfill {backfill_id} completed with issues. Status counts: {status_counts}")
    else:
        context.log.info(f"Backfill {backfill_id} completed successfully.")
        # send a "backfill completed successfully" notification
        if notify == "true":
            send_slack_notification(backfill_id, "success", f"Backfill {backfill_id} completed successfully. Status counts: {status_counts}")
    
    with conn.cursor() as cur:
      cur.execute(
        f"""
        UPDATE {BACKFILL_STATUS_TABLE}
        SET notified = TRUE
        WHERE backfill_id = %s;
        """,
        (backfill_id,)
      )
    conn.commit()

    if continue_etl == "true" and job_name == "extract_users_job":
      runs = []
      context.log.info(f"Triggering transform_load_users_job for backfill {backfill_id}. {len(partitions)} partitions found.")
      stdin_data = ",".join(partitions)
      try:
          exec(["experts", "harvest", "dagster", "run-transform-load-users-job", "--tags", "notify=true", "--partition-keys", "."], stdin_data=stdin_data, no_json_parse=True)
      except Exception as e:
          context.log.error(f"Error triggering transform_load_users_job for backfill {backfill_id}: {e}")
          raise e
      return dg.SkipReason(f"Executed backfill via cli.")
    else:
      return dg.SkipReason(f"No not a extract_users_job or continue_etl is not true for backfill {backfill_id}, skipping triggering next job.")

weekly_elt_init_schedule = dg.ScheduleDefinition(
    name="weekly_elt_init_schedule",
    description="Init the elastic search index and pull users from CDL for weekly ETL process.",
    cron_schedule="0 1 * * 6",  # Every Saturday at 1:00 AM
    job=init_weekly_etl,
    run_config={},
    execution_timezone="America/Los_Angeles",
    tags={
      "schedule": "weekly_elt_init_schedule",
      "notify": "true"
    },
)

weekly_elt_schedule = dg.ScheduleDefinition(
    name="weekly_elt_schedule",
    description="Run the weekly exec_weekly_etl process which kicks of the extract_users_job for all partitions.",
    cron_schedule="30 1 * * 6",  # Every Saturday at 1:30 AM
    target=[exec_weekly_etl],
    execution_timezone="America/Los_Angeles",
    run_config={},
    tags={},
)

defs = dg.Definitions(
    jobs=[etl_users_job, extract_users_job, transform_load_users_job],
    assets=[extract_user, transform_user_webapp, transform_user_standard, 
            load_user, init_databases, fetch_user_list_from_cdl,
            purge_user_cask_files, ensure_current_index, set_alias,
            create_indexes, delete_indexes, get_current_es_state, exec_weekly_etl, reload_search_template],
    sensors=[etl_notify_and_continue],
    resources={},
    schedules=[weekly_elt_init_schedule, weekly_elt_schedule],
    executor=celery_executor.configured({
        "broker": "pyamqp://guest:guest@rabbitmq:5672//",
        "backend": "rpc://"
    })
)