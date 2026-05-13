import { config, logger } from '@ucd-lib/experts-commons';
import fetch from 'node-fetch';

class DagsterAPI {

  async graphqlQuery(query, variables = {}, operationName = null) {
    let body = {
      query,
      variables,
    };
    if( operationName ) {
      body.operationName = operationName;
    }

    let resp = await fetch(config.dagster.host+config.dagster.graphqlPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if( !resp.ok ) {
      logger.error('Dagster API error', { 
        status: resp.status, 
        statusText: resp.statusText,
        body: await resp.text() 
      });
      throw new Error(`Dagster API error: ${resp.status} ${resp.statusText}`);
    }

    return resp.json();
  }

  wrapDefaults(obj={}, asSelector=false) {
    if( asSelector ) {
      if( !obj.repositorySelector ) {
        obj.repositorySelector = {
          repositoryLocationName: config.dagster.repositoryLocationName,
          repositoryName: config.dagster.repositoryName
        };
      }
      return obj;
    }

    if( !obj.repositoryLocationName ) {
      obj.repositoryLocationName = config.dagster.repositoryLocationName;
    }
    if( !obj.repositoryName ) {
      obj.repositoryName = config.dagster.repositoryName;
    }
    return obj;
  }

  async getDynamicPartitions(partitionsDefName) {
    if( !partitionsDefName ) throw new Error('partitionsDefName is required');

    const query = `query GetDynamicPartitions(
      $repositorySelector: RepositorySelector!,
      $partitionsDefName: String!
    ) {
      dynamicPartitionsOrError(
        repositorySelector: $repositorySelector,
        partitionsDefName: $partitionsDefName
      ) {
        __typename
        ... on DynamicPartitions {
          partitionKeys
        }
        ... on PythonError {
          message
        }
      }
    }`;

    const resp = await this.graphqlQuery(query, this.wrapDefaults({
      partitionsDefName
    }, true));

    const result = resp?.data?.dynamicPartitionsOrError;
    if( !result ) {
      throw new Error('No dynamicPartitionsOrError in response: '+JSON.stringify(resp));
    }
    if( result.__typename === 'PythonError' ) {
      throw new Error('Dagster error fetching dynamic partitions: '+result.message);
    }
    return result.partitionKeys || [];
  }

  async deleteDynamicPartitions(partitionsDefName, partitionKeys) {
    if( !partitionsDefName ) throw new Error('partitionsDefName is required');
    if( !partitionKeys || !Array.isArray(partitionKeys) || partitionKeys.length === 0 ) {
      throw new Error('partitionKeys must be a non-empty array');
    }
    
    const mutation = `mutation deleteDynamicPartitions(
      $repositorySelector: RepositorySelector!,
      $partitionsDefName: String!,
      $partitionKeys: [String!]!
    ) {
      deleteDynamicPartitions(
        repositorySelector: $repositorySelector,
        partitionsDefName: $partitionsDefName,
        partitionKeys: $partitionKeys
      ) {
        ... on DeleteDynamicPartitionsSuccess {
          partitionsDefName
        }
        ... on PythonError {
          message
        }
      }
    }`;
    return this.graphqlQuery(mutation, this.wrapDefaults({
      partitionsDefName,
      partitionKeys
    }, true));
  }

  async createDynamicPartitions(partitionsDefName, partitionKeys) {
    if( !partitionsDefName ) throw new Error('partitionsDefName is required');
    if( !partitionKeys || !Array.isArray(partitionKeys) || partitionKeys.length === 0 ) {
      throw new Error('partitionKeys must be a non-empty array');
    }

    let results = [];
    for( let key of partitionKeys ) {
      results.push(await this.createDynamicPartition(partitionsDefName, key));
    }

    return results;
  }

  createDynamicPartition(partitionsDefName, partitionKey) {
    logger.info('Creating dynamic partition', { partitionsDefName, partitionKey });

    if( !partitionsDefName ) throw new Error('partitionsDefName is required');
    if( !partitionKey ) throw new Error('partitionKey is required');

    const mutation = `mutation AddDynamicPartition(
      $repositorySelector: RepositorySelector!,
      $partitionsDefName: String!, 
      $partitionKey: String!) {
      addDynamicPartition(
        repositorySelector: $repositorySelector,
        partitionsDefName: $partitionsDefName,
        partitionKey: $partitionKey
      ) {
        ... on AddDynamicPartitionSuccess {
          partitionsDefName
          partitionKey
        }
        ... on PythonError {
          message
        }
      }
    }`;

    return this.graphqlQuery(mutation, this.wrapDefaults({
      partitionsDefName,
      partitionKey
    }, true));
  }

  startBackfill(jobName, steps, partitionKeys, tags={}) {
    if( !partitionKeys || !Array.isArray(partitionKeys) || partitionKeys.length === 0 ) {
      throw new Error('partitionKeys must be a non-empty array');
    }

    let t = [];
    for( let key in tags ) {
      t.push({ key: key, value: tags[key] });
    }
    tags = t;

    const mutation = `mutation LaunchPartitionBackfill(
        $backfillParams: LaunchBackfillParams!
    ) {
        launchPartitionBackfill(backfillParams: $backfillParams) {
            __typename
            ... on LaunchBackfillSuccess {
                backfillId
                launchedRunIds
            }
            ... on PartitionSetNotFoundError {
                message
            }
            ... on PythonError {
                message
                stack
            }
        }
    }`;

    const variables = {
      backfillParams: {
        assetSelection: steps.map(i => ({ path: [i] })),
        partitionNames: partitionKeys,
        selector: {
          repositorySelector: {
            repositoryLocationName: config.dagster.repositoryLocationName,
            repositoryName: config.dagster.repositoryName
          },
          partitionSetName: jobName + "_partition_set"
        },
        tags
      }
    }

    return this.graphqlQuery(mutation, variables);
  }
}

export default DagsterAPI;