from dagster import DynamicPartitionsDefinition
from dagster._core.instance import DagsterInstance

# Replace with your actual dynamic partition definition name
# my_partitions_def = DynamicPartitionsDefinition(name="users_partitions")

# Connect to your Dagster instance
instance = DagsterInstance.get()

# Delete the bad partition
instance.delete_dynamic_partition("users_partitions", "jrmerz@ucdavis.deu")