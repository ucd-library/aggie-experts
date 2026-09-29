"""
Dagster op definitions for fan-out style jobs (dynamic mapping over child folders/items).
"""
import subprocess

import dagster as dg
from dagster import DynamicOut, DynamicOutput, Out, Output, RetryPolicy

from .configs import PurgeYearWeekConfig
from .utils import CODE_VERSION, exec

CASK_LS_PAGE_LIMIT = 200


def _list_directory_page(directory: str, page: int, limit: int) -> dict:
    """Fetch a single page of a CaskFS directory listing.

    @param {str} directory - CaskFS directory path to list
    @param {int} page - 1-based page number
    @param {int} limit - page size
    @returns {dict} parsed `cask ls` JSON response: {files, directories, totalCount}
    """
    return exec(["cask", "ls", directory, "-o", "json", "-l", str(limit), "-n", str(page)])


def _crawl_year_week_delete_items(year_week: str, page_limit: int = CASK_LS_PAGE_LIMIT):
    """Recursively crawl a year-week's CaskFS tree, yielding one delete item per file and
    one per user folder (user folders are treated as a single atomic recursive delete rather
    than being crawled down to their individual files).

    @param {str} year_week - year-week in format YYYY-WW
    @param {int} page_limit - `cask ls` page size to use while crawling
    @yields {dict} {"path": str, "recursive": bool}
    """
    user_root = f"/weekly/{year_week}/user"
    stack = [f"/weekly/{year_week}"]

    while stack:
        directory = stack.pop()
        page = 1
        while True:
            result = _list_directory_page(directory, page, page_limit)
            files = result.get("files", [])
            directories = result.get("directories", [])

            for file in files:
                yield {"path": file["filepath"], "recursive": False}

            for child in directories:
                if directory == user_root:
                    yield {"path": child["fullname"], "recursive": True}
                else:
                    stack.append(child["fullname"])

            if not files and not directories:
                break
            if page * page_limit >= result.get("totalCount", 0):
                break
            page += 1


# ---------------------------------------------------------------------------
# Cleanup ops: fan-out purge of a year-week's CaskFS files
# ---------------------------------------------------------------------------

@dg.op(
    code_version=CODE_VERSION,
    out={
        "year_week": Out(str),
        "delete_item_batches": DynamicOut(list),
    },
)
def list_year_week_delete_items(context: dg.OpExecutionContext, config: PurgeYearWeekConfig):
    """Crawl a year-week's CaskFS tree and yield batches of delete items (files and user folders),
    one dynamic output per batch.  Defaults year-week to 5 weeks ago if not provided."""
    year_week = config.year_week
    if not year_week:
        year_week = subprocess.check_output(
            ["experts", "harvest", "year-week", "--weeks-ago", "5"], text=True
        ).strip()

    context.log.info(f"Crawling CaskFS delete items for year-week {year_week}")
    yield Output(year_week, "year_week")

    batch = []
    batch_index = 0
    total_items = 0

    for item in _crawl_year_week_delete_items(year_week):
        batch.append(item)
        total_items += 1
        if len(batch) >= config.batch_size:
            yield DynamicOutput(batch, mapping_key=f"batch_{batch_index}", output_name="delete_item_batches")
            batch_index += 1
            batch = []

    if batch:
        yield DynamicOutput(batch, mapping_key=f"batch_{batch_index}", output_name="delete_item_batches")
        batch_index += 1

    context.log.info(f"Found {total_items} delete items in {batch_index} batches for year-week {year_week}")


@dg.op(
    code_version=CODE_VERSION,
    retry_policy=RetryPolicy(max_retries=2, delay=10),
    tags={"dagster/concurrency_key": "cask_fs_delete"},
)
def delete_cask_batch(context: dg.OpExecutionContext, batch: list) -> int:
    """Delete a batch of CaskFS items, one `cask rm` call per item."""
    for item in batch:
        cmd = ["cask", "rm", "--ignore-missing"]
        if item["recursive"]:
            cmd.append("-d")
        cmd.append(item["path"])
        exec(cmd, no_json_parse=True)

    context.log.info(f"Deleted {len(batch)} items")
    return len(batch)


@dg.op(code_version=CODE_VERSION)
def finalize_year_week_purge(context: dg.OpExecutionContext, year_week: str, batch_counts: list) -> str:
    """Sweep up the year-week's parent folder after all of its delete-item batches have been purged."""
    total_items = sum(batch_counts)
    context.log.info(f"Purged {total_items} items across {len(batch_counts)} batches for year-week {year_week}, finalizing cleanup")
    exec(["cask", "rm", "-d", f"/weekly/{year_week}"], no_json_parse=True)
    return year_week


@dg.graph_asset(
    code_version=CODE_VERSION,
    group_name="cleanup",
)
def purge_year_week_cask_files():
    """Purge all files from CaskFS before a given year-week, fanning out one delete per batch of items."""
    year_week, delete_item_batches = list_year_week_delete_items()
    batch_counts = delete_item_batches.map(delete_cask_batch)
    return finalize_year_week_purge(year_week, batch_counts.collect())
