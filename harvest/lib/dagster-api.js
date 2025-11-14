import config from './config.js';
import logger from './logger.js';
import fetch from 'node-fetch';

class DagsterAPI {

  async graphqlQuery(query, variables = {}) {
    let resp = await fetch(config.dagster.host+config.dagster.graphqlPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
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
}

export default DagsterAPI;