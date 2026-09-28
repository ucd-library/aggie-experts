"""
Dagster op definitions for fan-out style jobs (dynamic mapping over child folders/items).
"""
import re
import subprocess

import dagster as dg
from dagster import DynamicOut, DynamicOutput, Out, Output, RetryPolicy

from .configs import PurgeYearWeekConfig
from .utils import CODE_VERSION, exec

CASK_LS_PAGE_LIMIT = 200


def _sanitize_mapping_key(name: str, index: int) -> str:
    """Turn a CaskFS folder name into a valid, unique Dagster dynamic-output mapping key."""
    key = re.sub(r"[^A-Za-z0-9_]", "_", name) or "folder"
    return f"{key}_{index}"[:64]


# ---------------------------------------------------------------------------
# Cleanup ops: fan-out purge of a year-week's CaskFS user folders
# ---------------------------------------------------------------------------

@dg.op(
    code_version=CODE_VERSION,
    out={
        "year_week": Out(str),
        "user_folders": DynamicOut(str),
    },
)
def list_year_week_user_folders(context: dg.OpExecutionContext, config: PurgeYearWeekConfig):
    """List CaskFS user folders under a year-week, yielding one dynamic output per folder.  Defaults year-week to 5 weeks ago if not provided."""
    year_week = config.year_week
    if not year_week:
        year_week = subprocess.check_output(
            ["experts", "harvest", "year-week", "--weeks-ago", "5"], text=True
        ).strip()

    context.log.info(f"Listing CaskFS user folders for year-week {year_week}")
    yield Output(year_week, "year_week")

    page = 1
    total_yielded = 0
    while True:
        result = exec(
            ["cask", "ls", f"/weekly/{year_week}/user", "-o", "json", "-l", str(CASK_LS_PAGE_LIMIT), "-n", str(page)]
        )
        directories = result.get("directories", [])
        if not directories:
            break

        for directory in directories:
            yield DynamicOutput(
                directory["fullname"],
                mapping_key=_sanitize_mapping_key(directory["name"], total_yielded),
                output_name="user_folders",
            )
            total_yielded += 1

        if page * CASK_LS_PAGE_LIMIT >= result.get("totalCount", 0):
            break
        page += 1

    context.log.info(f"Found {total_yielded} user folders to purge for year-week {year_week}")


@dg.op(
    code_version=CODE_VERSION,
    retry_policy=RetryPolicy(max_retries=2, delay=10),
    tags={"dagster/concurrency_key": "cask_fs_delete"},
)
def delete_cask_folder(context: dg.OpExecutionContext, folder_path: str) -> str:
    """Recursively delete a single CaskFS folder."""
    exec(["cask", "rm", "-d", folder_path], no_json_parse=True)
    return folder_path


@dg.op(code_version=CODE_VERSION)
def finalize_year_week_purge(context: dg.OpExecutionContext, year_week: str, deleted_folders: list) -> str:
    """Sweep up the year-week's parent folder after all of its user folders have been purged."""
    context.log.info(f"Purged {len(deleted_folders)} user folders for year-week {year_week}, finalizing cleanup")
    exec(["cask", "rm", "-d", f"/weekly/{year_week}"], no_json_parse=True)
    return year_week


@dg.graph_asset(
    code_version=CODE_VERSION,
    group_name="cleanup",
)
def purge_year_week_cask_files():
    """Purge all files from CaskFS before a given year-week, fanning out one delete per user folder."""
    year_week, user_folders = list_year_week_user_folders()
    deleted_folders = user_folders.map(delete_cask_folder)
    return finalize_year_week_purge(year_week, deleted_folders.collect())
