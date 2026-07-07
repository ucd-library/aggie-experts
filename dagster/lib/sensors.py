"""
Dagster sensor definitions for the Aggie Experts ETL pipeline.
"""
import dagster as dg

from .utils import (
    conn,
    BACKFILL_STATUS_TABLE,
    BACKFILL_UPDATE_FN,
    exec,
    _notify_backfill_completion,
)


# ---------------------------------------------------------------------------
# Sensors
# ---------------------------------------------------------------------------

@dg.sensor(
    description="Sensor to notify when a backfill is complete and optionally continue the ETL process, executing transform_load_users_job on complete of extract_users_job.",
    minimum_interval_seconds=60  # Check every 60 seconds
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
                    f"No result from is_active function for backfill {backfill_id}.  Assuming active."
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

            # Currently these seem to come out in reverse order (latest first), so we will ignore keys we have already seen
            latest_by_partition = {}
            for run_record in run_records:
                partition_key = run_record.dagster_run.tags.get("dagster/partition")
                if not partition_key:
                    continue
                if partition_key in latest_by_partition:
                    continue
                latest_by_partition[partition_key] = run_record

            latest_run_records = list(latest_by_partition.values())
            statuses = [r.dagster_run.status for r in latest_run_records]

            successfull_runs = [r for r in latest_run_records if r.dagster_run.status == dg.DagsterRunStatus.SUCCESS]
            next_partitions = [r.dagster_run.tags.get("dagster/partition") for r in successfull_runs]

            if notify == "true":
                _notify_backfill_completion(context, backfill_id, statuses=statuses, job_name=job_name)

            if continue_etl == "true" and job_name == "extract_users_job":
                context.log.info(f"Triggering transform_load_users_job for backfill {backfill_id}. {len(next_partitions)} successfull partitions found.")
                stdin_data = ",".join(next_partitions)
                try:
                    cmd = ["experts", "harvest", "dagster", "run-transform-load-users-job"]
                    if notify == "true":
                        cmd += ["--notify", "true"]
                    cmd += ["--continue-etl"]
                    cmd += ["--partition-keys", "."]
                    exec(cmd, stdin_data=stdin_data, no_json_parse=True)
                except Exception as e:
                    context.log.error(f"Error triggering transform_load_users_job for backfill {backfill_id}: {e}")
                    raise e
                context.log.info(f"Executed backfill via cli.")
            elif continue_etl == "true" and job_name == "transform_load_users_job":
                context.log.info(f"transform_load_users_job complete for backfill {backfill_id}. Triggering post_etl_job.")
                try:
                    exec(["experts", "harvest", "dagster", "run-post-etl-job"], no_json_parse=True)
                except Exception as e:
                    context.log.error(f"Error triggering post_etl_job for backfill {backfill_id}: {e}")
                    raise e
                context.log.info(f"Launched post_etl_job via cli.")
            else:
                context.log.info(f"No not a extract_users_job or continue_etl is not true for backfill {backfill_id}, skipping triggering next job.")
