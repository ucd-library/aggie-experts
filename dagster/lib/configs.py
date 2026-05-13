"""
Dagster config schemas and partition definitions shared across assets, jobs, and sensors.
"""
from dagster import Config, MultiPartitionsDefinition
import dagster as dg
from typing import Literal
from pydantic import Field


# ---------------------------------------------------------------------------
# Config schemas
# ---------------------------------------------------------------------------

class FetchUserListConfig(Config):
    group_id: Literal['experts', 'dev', 'sandbox'] = 'experts'  # Default value for group ID

# Make sure this matches /commons/lib/config.js:elasticsearch.aliases
class LoadUserConfig(Config):
    alias: Literal['public', 'latest', 'all'] = 'latest'  # Default alias/index for loading

class YearWeekConfig(Config):
    year_week: str = Field(..., description="Year-week for CaskFS purge in format YYYY-WW")


class PurgeYearWeekConfig(Config):
    year_week: str | None = Field(
        default=None,
        description="Optional year-week in format YYYY-WW"
    )


class NotifyConfig(Config):
    notify: str | None = Field(
        default=None,
        description="Optional slack notification message"
    )

# Make sure this matches /commons/lib/config.js:elasticsearch.aliases

class SetAliasConfig(Config):
    year_week: str = Field(..., description="Year-week for CaskFS purge in format YYYY-WW")
    alias: Literal['latest', 'public'] 


class ReloadSearchTemplateConfig(Config):
    template: str = Field('complete', description="Search template name to load into Elasticsearch")


class PurgeStaleUserPartitionsConfig(Config):
    group_id: Literal['experts', 'dev', 'sandbox'] = 'experts'  # CDL group to diff against
    force: bool = Field(
        default=False,
        description="If False (default), runs a dry-run that only logs which partitions would be deleted. Set True to actually delete them."
    )


# ---------------------------------------------------------------------------
# Partition definitions
# ---------------------------------------------------------------------------

users_partitions = dg.DynamicPartitionsDefinition(name="users")
year_week_partitions = dg.DynamicPartitionsDefinition(name="year-week")
multi_partitions = MultiPartitionsDefinition(
    {
        "user": users_partitions,
        "year-week": year_week_partitions,
    }
)
