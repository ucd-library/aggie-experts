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


class UpdateScholarlyRecordConfig(Config):
    expert_id: str = Field(..., description="Expert ID (e.g. expert/abc123)")
    relationship_id: str = Field(..., description="Relationship ARK ID (e.g. ark:/87287/d7mh2m/...)")
    type: Literal['work', 'grant'] = Field('work', description="Record type")
    elasticsearch: Literal['yes', 'no'] = Field('yes', description="Update Elasticsearch")
    cdl: Literal['yes', 'no'] = Field('yes', description="Propagate to CDL/Elements")
    visibility: str | None = Field(default=None, description="Set visibility (yes or no)")
    favorite: str | None = Field(default=None, description="Set as favorite, works only (yes or no)")
    reject: str | None = Field(default=None, description="Reject/delete authorship, works only (yes or no)")


class UpdateExpertConfig(Config):
    expert_id: str = Field(..., description="Expert ID (e.g. expert/abc123)")
    elasticsearch: Literal['yes', 'no'] = Field('yes', description="Update Elasticsearch")
    cdl: Literal['yes', 'no'] = Field('yes', description="Propagate to CDL/Elements")
    visibility: str | None = Field(default=None, description="Set visibility (yes or no)")
    delete: str | None = Field(default=None, description="Delete the expert record (yes or no)")


class UpdateExpertAvailabilityConfig(Config):
    expert_id: str = Field(..., description="Expert ID (e.g. expert/abc123)")
    elasticsearch: Literal['yes', 'no'] = Field('yes', description="Update Elasticsearch")
    cdl: Literal['yes', 'no'] = Field('yes', description="Propagate to CDL/Elements")
    labels_to_add: list[str] = Field(default_factory=list, description="Labels to add or edit")
    labels_to_remove: list[str] = Field(default_factory=list, description="Labels to remove")
    current_labels: list[str] = Field(default_factory=list, description="Current labels")


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
