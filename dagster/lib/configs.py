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


class LoadUserConfig(Config):
    alias: Literal['stage', 'current', 'all'] = 'stage'  # Default alias/index for loading


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


class SetAliasConfig(Config):
    year_week: str = Field(..., description="Year-week for CaskFS purge in format YYYY-WW")
    alias: Literal['stage', 'current']


class ReloadSearchTemplateConfig(Config):
    template: str = Field('complete', description="Search template name to load into Elasticsearch")


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
