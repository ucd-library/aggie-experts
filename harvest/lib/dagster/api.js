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

  async getDynamicPartitionsForAsset(assetName) {
    if( !assetName ) throw new Error('assetName is required');

    // We query the partition keys via assetNodeOrError because this Dagster
    // version's GraphQL schema doesn't expose a top-level dynamicPartitionsOrError
    // field. Any asset that uses the target DynamicPartitionsDefinition will
    // return the same list of partition keys (e.g. extract_user / transform_user_*
    // / load_user all share the 'users' partitions def).
    // AssetNodeOrError's union members vary across Dagster versions and don't
    // include PythonError here, so we just rely on __typename to detect a
    // non-AssetNode response rather than spreading another fragment.
    const query = `query GetAssetPartitionKeys($assetKey: AssetKeyInput!) {
      assetNodeOrError(assetKey: $assetKey) {
        __typename
        ... on AssetNode {
          partitionKeys
        }
      }
    }`;

    const resp = await this.graphqlQuery(query, {
      assetKey: { path: [assetName] }
    });

    const result = resp?.data?.assetNodeOrError;
    if( !result ) {
      throw new Error('No assetNodeOrError in response: '+JSON.stringify(resp));
    }
    if( result.__typename !== 'AssetNode' ) {
      throw new Error(
        `Dagster could not resolve asset '${assetName}' (got ${result.__typename}). `+
        `Update the refAsset in remove-stale-user-partitions if this asset was renamed.`
      );
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