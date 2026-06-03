"""
Shared utilities: database connection, constants, subprocess helpers, and notification helpers.
Notifications are sent via the gateway service (commons library) to centralize Slack integration.
"""
import os
import sys
import json
import subprocess
import signal
import atexit

import dagster as dg
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
# Notification helpers
# ---------------------------------------------------------------------------

def _notify_backfill_completion(context, backfill_id: str, statuses: list = None, job_name: str = None):
    """Mark a backfill as notified in the DB and send a Slack notification via the admin CLI."""
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
    harvest_url = os.getenv('HARVEST_URL', 'http://localhost:4000')
    has_issues = any(s != dg.DagsterRunStatus.SUCCESS for s in statuses)

    outcome = "completed with issues" if has_issues else "completed successfully"
    message = (
        f"Job {job_name} {outcome}.\n"
        f"Status counts: {status_counts}\n"
        f"Backfill ID: {backfill_id}\n"
        f"<{harvest_url}|View Backfill Details on {harvest_url}>"
    )

    context.log.info(f"Backfill {backfill_id} {outcome}.")
    exec(
        ["admin", "notify",
         "--title", f"Job {job_name} {outcome}",
         "--message", message,
         "--severity", "warning" if has_issues else "info"],
        no_json_parse=True
    )
