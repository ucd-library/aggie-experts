"""
Dagster config schemas and partition definitions shared across assets, jobs, and sensors.
"""
from dagster import Config, MultiPartitionsDefinition
import dagster as dg
from typing import Any, Literal
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
    visibility: str | None = Field(default=None, description="Set visibility (yes or no)")
    favorite: str | None = Field(default=None, description="Set as favorite, works only (yes or no)")
    reject: str | None = Field(default=None, description="Reject/delete authorship, works only (yes or no)")


class UpdateScholarlyRecordCdlConfig(Config):
    expert_id: str = Field(..., description="Expert ID (e.g. expert/abc123)")
    relationship_id: str = Field(..., description="Relationship ARK ID (e.g. ark:/87287/d7mh2m/...)")
    type: Literal['work', 'grant'] = Field('work', description="Record type")
    visibility: str | None = Field(default=None, description="Set visibility (yes or no)")
    favorite: str | None = Field(default=None, description="Set as favorite, works only (yes or no)")
    reject: str | None = Field(default=None, description="Reject/delete authorship, works only (yes or no)")
    cdl_enabled: bool = Field(True, description="Whether CDL propagation is enabled")


class UpdateExpertConfig(Config):
    expert_id: str = Field(..., description="Expert ID (e.g. expert/abc123)")
    visibility: str | None = Field(default=None, description="Set visibility (yes or no)")
    delete: str | None = Field(default=None, description="Delete the expert record (yes or no)")


class UpdateExpertCdlConfig(Config):
    expert_id: str = Field(..., description="Expert ID (e.g. expert/abc123)")
    visibility: str | None = Field(default=None, description="Set visibility (yes or no)")
    delete: str | None = Field(default=None, description="Delete the expert record (yes or no)")
    cdl_enabled: bool = Field(True, description="Whether CDL propagation is enabled")


class UpdateExpertAvailabilityConfig(Config):
    expert_id: str = Field(..., description="Expert ID (e.g. expert/abc123)")
    labels_to_add: list[Any] = Field(default_factory=list, description="Labels to add or edit (objects with value/percentage fields)")
    labels_to_remove: list[str] = Field(default_factory=list, description="Labels to remove")
    current_labels: list[str] = Field(default_factory=list, description="Current labels")


class UpdateExpertAvailabilityCdlConfig(Config):
    expert_id: str = Field(..., description="Expert ID (e.g. expert/abc123)")
    labels_to_add: list[Any] = Field(default_factory=list, description="Labels to add or edit (objects with value/percentage fields)")
    labels_to_remove: list[str] = Field(default_factory=list, description="Labels to remove")
    current_labels: list[str] = Field(default_factory=list, description="Current labels")
    cdl_enabled: bool = Field(True, description="Whether CDL propagation is enabled")
class SlackNotifyConfig(Config):
    title: str = Field(..., description="Message title")
    message: str = Field('', description="Message body")
    severity: str = Field('info', description="Severity level: info, warning, or error")
    source: str = Field('dagster', description="Source label shown in the notification")


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
