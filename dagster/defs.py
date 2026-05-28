"""
Dagster definitions for the Aggie Experts ETL pipeline.

Submodule layout (all files live alongside this one in the dagster/ directory):
  configs.py  - Config schemas and partition definitions
  utils.py    - DB connection, constants, exec() helper, Slack notifications
  assets.py   - All @dg.asset definitions
  jobs.py     - All dg.define_asset_job definitions
  sensors.py  - All @dg.sensor definitions
  schedules.py - All dg.ScheduleDefinition instances

Note: Dagster inserts this file's parent directory into sys.path when loading via
`python_file` in workspace.yaml, so the sibling-module imports below work without
an __init__.py.  (Adding __init__.py to this directory would shadow the installed
`dagster` package and break things.)
"""
import dagster as dg
from dagster_celery import celery_executor

from lib.assets import (
    extract_user,
    transform_user_standard,
    transform_user_webapp,
    load_user,
    init_databases,
    fetch_user_list_from_cdl,
    ensure_current_index,
    set_alias,
    reload_search_template,
    create_indexes,
    delete_indexes,
    get_current_es_state,
    exec_weekly_etl,
    purge_user_cask_files,
    purge_year_week_cask_files,
    purge_dagster_runs,
    purge_reporting_db,
    update_scholarly_record,
    update_expert,
    update_expert_availability,
)
from lib.jobs import (
    etl_users_job,
    extract_users_job,
    transform_load_users_job,
    start_weekly_etl_job,
    cleanup_job,
    update_scholarly_record_job,
    update_scholarly_record_es_job,
    update_scholarly_record_cdl_job,
    update_expert_job,
    update_expert_es_job,
    update_expert_cdl_job,
    update_expert_availability_job,
    update_expert_availability_es_job,
    update_expert_availability_cdl_job,
)
from lib.sensors import etl_notify_and_continue
from lib.schedules import (
    weekly_elt_schedule_prod,
    weekly_elt_schedule_dev,
    cleanup_schedule_prod,
    cleanup_schedule_dev,
)

defs = dg.Definitions(
    jobs=[
        etl_users_job, extract_users_job, transform_load_users_job, start_weekly_etl_job, cleanup_job,
        update_scholarly_record_job, update_scholarly_record_es_job, update_scholarly_record_cdl_job,
        update_expert_job, update_expert_es_job, update_expert_cdl_job,
        update_expert_availability_job, update_expert_availability_es_job, update_expert_availability_cdl_job,
    ],
    assets=[
        extract_user, transform_user_webapp, transform_user_standard,
        load_user, init_databases, fetch_user_list_from_cdl,
        ensure_current_index, set_alias, reload_search_template,
        create_indexes, delete_indexes, get_current_es_state, exec_weekly_etl,
        purge_user_cask_files, purge_year_week_cask_files, purge_dagster_runs, purge_reporting_db,
        update_scholarly_record, update_expert, update_expert_availability,
    ],
    sensors=[etl_notify_and_continue],
    resources={},
    schedules=[
        weekly_elt_schedule_prod, weekly_elt_schedule_dev,
        cleanup_schedule_prod, cleanup_schedule_dev,
    ],
    executor=celery_executor.configured({
        "broker": "pyamqp://guest:guest@rabbitmq:5672//",
        "backend": "rpc://"
    })
)
