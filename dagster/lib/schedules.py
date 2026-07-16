"""
Dagster schedule definitions for the Aggie Experts ETL pipeline.
"""
import dagster as dg
from dagster import RunRequest

from .jobs import cleanup_job, start_weekly_etl_job, grant_feed_email_job


# ---------------------------------------------------------------------------
# Schedules
# ---------------------------------------------------------------------------

cleanup_schedule_prod = dg.ScheduleDefinition(
    name="weekly_cleanup_schedule_prod",
    description="Kick off cleanup_job.",
    cron_schedule="0 22 * * 5",  # Every Friday at 10:00 PM
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
    cron_schedule="0 22 * * 6",  # Every Saturday at 10:00 PM
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


# ON HOLD (security review): these grant-feed email-check schedules are defined
# but NOT registered in defs.py, so no automatic inbox polling happens. Input is
# placed in GCS manually and grant_feed_job is run by hand. Kept here so they
# can be re-enabled by re-registering them in defs.py.
#
# When active: poll every 6 hours; check_grant_feed_email triggers
# grant_feed_job only when a new AEgrants.xml is found, so most runs no-op.
grant_feed_email_schedule_prod = dg.ScheduleDefinition(
    name="grant_feed_email_schedule_prod",
    description="Six-hourly check of the AE grant-feed inbox; stages new input and triggers the grant-feed ETL.",
    cron_schedule="0 */6 * * *",  # Every 6 hours (00:00, 06:00, 12:00, 18:00)
    job=grant_feed_email_job,
    execution_timezone="America/Los_Angeles",
    tags={
        "env": "prod"
    },
)

grant_feed_email_schedule_dev = dg.ScheduleDefinition(
    name="grant_feed_email_schedule_dev",
    description="Six-hourly check of the AE grant-feed inbox; stages new input and triggers the grant-feed ETL.",
    cron_schedule="30 */6 * * *",  # Every 6 hours, offset 30 min from prod
    job=grant_feed_email_job,
    execution_timezone="America/Los_Angeles",
    tags={
        "env": "dev"
    },
)
