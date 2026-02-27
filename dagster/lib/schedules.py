"""
Dagster schedule definitions for the Aggie Experts ETL pipeline.
"""
import dagster as dg

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
    run_config={},
    tags={},
)

cleanup_schedule_dev = dg.ScheduleDefinition(
    name="weekly_cleanup_schedule_dev",
    description="Kick off cleanup_job.",
    cron_schedule="0 17 * * 0",  # Every Sunday at 5:00 PM
    job=cleanup_job,
    execution_timezone="America/Los_Angeles",
    run_config={},
    tags={},
)

weekly_elt_schedule_prod = dg.ScheduleDefinition(
    name="weekly_elt_schedule_prod",
    description="Kick off start_weekly_etl_job.",
    cron_schedule="0 1 * * 6",  # Every Saturday at 1:00 AM
    job=start_weekly_etl_job,
    execution_timezone="America/Los_Angeles",
    run_config={},
    tags={
        "pull-cdl": "experts",
        "notify": "true"
    },
)

weekly_elt_schedule_dev = dg.ScheduleDefinition(
    name="weekly_elt_schedule_dev",
    description="Kick off start_weekly_etl_job.",
    cron_schedule="0 1 * * 0",  # Every Sunday at 1:00 AM
    job=start_weekly_etl_job,
    execution_timezone="America/Los_Angeles",
    run_config={},
    tags={
        "pull-cdl": "experts"
    },
)
