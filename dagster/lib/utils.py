"""
Shared utilities: database connection, constants, subprocess helpers, and Slack notification helpers.
"""
import os
import sys
import json
import subprocess
import signal
import atexit

import dagster as dg
import requests
import psycopg2


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CODE_VERSION = "0.1"

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


# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------

conn = psycopg2.connect(
    host=os.getenv('DAGSTER_POSTGRES_HOST', 'localhost'),
    database=os.getenv('DAGSTER_POSTGRES_DB', 'dagster'),
    user=os.getenv('DAGSTER_POSTGRES_USER', 'postgres'),
    password=os.getenv('DAGSTER_POSTGRES_PASSWORD', 'postgres')
)


# ---------------------------------------------------------------------------
# Subprocess helper
# ---------------------------------------------------------------------------

def exec(cmd, check=True, capture_output=True, text=True, stdin_data=None, no_json_parse=False):
    """Helper function to run a command, stream its output, and return the last line as JSON."""
    print(f"Executing command: {' '.join(cmd)}")

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,  # Merge stderr into stdout for single-stream reading
        stdin=subprocess.PIPE if stdin_data is not None else None,
        text=True,
        bufsize=1,  # Line buffering
        start_new_session=True
    )

    if stdin_data is not None:
        process.stdin.write(stdin_data)
        process.stdin.close()

    def terminate_child():
        if process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except Exception:
                try:
                    process.terminate()
                except Exception:
                    pass

    cleanup_handler = terminate_child
    atexit.register(cleanup_handler)

    try:
        last_line = ""

        assert process.stdout is not None
        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            last_line = line

        rc = process.wait()

        if check and rc != 0:
            raise subprocess.CalledProcessError(rc, cmd, output="")

        if no_json_parse:
            return last_line

        try:
            return json.loads(last_line)
        except json.JSONDecodeError:
            return {"error": "failed to decode last line of cli stdout as json response"}
    finally:
        atexit.unregister(cleanup_handler)
        if process.stdout:
            process.stdout.close()


# ---------------------------------------------------------------------------
# Slack / notification helpers
# ---------------------------------------------------------------------------

def send_slack_notification(context, backfill_id: str, status: str, message: str):
    """Send a Slack notification about backfill completion via webhook."""
    webhook_url = os.getenv('SLACK_WEBHOOK_URL')
    app_url = os.getenv('ANDUIN_APP_URL', 'http://localhost:4000')

    if not webhook_url:
        context.log.warning("Warning: SLACK_WEBHOOK_URL not set, skipping Slack notification")
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


def _notify_backfill_completion(context, backfill_id: str, statuses: list = None, job_name: str = None):
    """Mark a backfill as notified in the DB and send Slack message."""
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

    # Compute counts per status
    status_counts = {s.value: statuses.count(s) for s in set(statuses)}

    if any(s != dg.DagsterRunStatus.SUCCESS for s in statuses):
        context.log.info(f"Backfill {backfill_id} completed with issues.")
        send_slack_notification(context, backfill_id, "failure", f"Job {job_name} completed *with issues.*\nStatus counts: {status_counts}")
    else:
        context.log.info(f"Backfill {backfill_id} completed successfully.")
        send_slack_notification(context, backfill_id, "success", f"Job {job_name} completed *successfully.*\nStatus counts: {status_counts}")
