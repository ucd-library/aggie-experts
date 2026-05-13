"""
Dagster schedule definitions for the Aggie Experts ETL pipeline.
"""
import dagster as dg
from dagster import RunRequest

from .jobs import cleanup_job, start_weekly_etl_job


# ---------------------------------------------------------------------------
# Schedules
# ---------------------------------------------------------------------------

cleanup_schedule_prod = dg.ScheduleDefinition(
    name="weekly_cleanup_schedule_prod",
    description="Kick off cleanup_job.",
    cron_schedule="0 17 * * 6",  # Every Saturday at 5:00 PM
    job=cleanup_job,
    execution_timezone="America/Los_Angeles",
    run_config={
        "ops": {
            "purge_stale_user_partitions": {
                "config": {
                    "group_id": "experts",
                    "force": True
                }
            }
        }
    },
    tags={
        "env": "prod"
    },
)

cleanup_schedule_dev = dg.ScheduleDefinition(
    name="weekly_cleanup_schedule_dev",
    description="Kick off cleanup_job.",
    cron_schedule="0 17 * * 0",  # Every Sunday at 5:00 PM
    job=cleanup_job,
    execution_timezone="America/Los_Angeles",
    run_config={
        "ops": {
            "purge_stale_user_partitions": {
                "config": {
                    "group_id": "experts",
                    "force": True
                }
            }
        }
    },
    tags={
        "env": "dev"
    },
)

weekly_elt_schedule_prod = dg.ScheduleDefinition(
    name="weekly_elt_schedule_prod",
    description="Kick off start_weekly_etl_job.",
    cron_schedule="0 1 * * 6",  # Every Saturday at 1:00 AM
    job=start_weekly_etl_job,
    execution_timezone="America/Los_Angeles",
    run_config={
        "ops": {
            "fetch_user_list_from_cdl": {
                "config": {
                    "group_id": "experts"
                }
            },
            "exec_weekly_etl": {
                "config": {
                    "notify": "true"
                }
            }
        }
    },
    tags={
        "env": "prod"
    },
)

# leaving this here as an example how to.
# def schedule_dev_run(context):
#     return RunRequest(
#         run_key=None,
#         tags={
#             "pull-cdl": "experts"
#         }
#     )

weekly_elt_schedule_dev = dg.ScheduleDefinition(
    name="weekly_elt_schedule_dev",
    description="Kick off start_weekly_etl_job.",
    cron_schedule="0 1 * * 0",  # Every Sunday at 1:00 AM
    job=start_weekly_etl_job,
    execution_timezone="America/Los_Angeles",
    # execution_fn=schedule_dev_run,
    run_config={
        "ops": {
            "fetch_user_list_from_cdl": {
                "config": {
                    "group_id": "experts"
                }
            },
            "exec_weekly_etl": {
                "config": {
                    "notify": "true"
                }
            }
        }
    },
    tags={
        "env": "dev"
    }
)
