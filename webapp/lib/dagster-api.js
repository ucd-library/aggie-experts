const config = require('../../commons/config.js');
const yaml = require('yaml');

class DagsterAPI {

  async graphqlQuery(operationName, query, variables = {}) {
    let resp = await fetch(config.dagster.host+config.dagster.graphqlPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        operationName,
        query,
        variables,
      }),
    });

    if( !resp.ok ) {
      throw new Error(`Dagster API error: ${resp.status} ${resp.statusText}`);
    }

    return resp.json();
  }

  wrapDefaults(obj={}) {
    if( !obj.repositoryLocationName ) {
      obj.repositoryLocationName = config.dagster.repositoryLocationName;
    }
    if( !obj.repositoryName ) {
      obj.repositoryName = config.dagster.repositoryName;
    }
    return obj;
  }


  runJobPartition(jobName, partitionName, runConfig = {}) {
    if( !jobName ) throw new Error('jobName is required');
    if( !partitionName ) throw new Error('partitionName is required');

    // by default ensure user is harvested in current and stage es index alias
    if( !runConfig.ops?.load_user?.config ) {
      if( !runConfig.ops ) runConfig.ops = {};
      if( !runConfig.ops.load_user ) runConfig.ops.load_user = {};
      if( !runConfig.ops.load_user.config ) runConfig.ops.load_user.config = {};
      runConfig.ops.load_user.config.alias = 'all';
    }

    if( typeof runConfig === 'object' ) {
      runConfig = yaml.stringify(runConfig);
    }

    const mutation = `
      mutation LaunchRunMutation(
        $repositoryLocationName: String!
        $repositoryName: String!
        $jobName: String!
        $runConfigData: RunConfigData!
        $partitionName: String!
      ) {
        launchRun(
          executionParams: {
            executionMetadata : {
              tags : [
                {key:"dagster/partition_set", value: "${config.dagster.etlPartitionSet}"},
                {key: "dagster/partition", value: $partitionName}
              ]
            }
            selector: {
              repositoryLocationName: $repositoryLocationName
              repositoryName: $repositoryName
              jobName: $jobName
            }
            runConfigData: $runConfigData
          }
        ) {
          __typename
          ... on LaunchRunSuccess {
            run {
              runId
            }
          }
          ... on RunConfigValidationInvalid {
            errors {
              message
              reason
            }
          }
          ... on PythonError {
            message
          }
        }
      }
      `;

    return this.graphqlQuery(
      'LaunchRunMutation',
      mutation,
      this.wrapDefaults({
        jobName,
        runConfigData: runConfig,
        partitionName
      }));
  }

  async getRunStatus(runId) {
    if (!runId) throw new Error('runId is required');

    const query = `
      query GetRunStatus($runId: ID!) {
        runOrError(runId: $runId) {
          __typename
          ... on Run {
            runId
            status
            startTime
            endTime
            updateTime
            jobName
            mode
            tags {
              key
              value
            }
            stats {
              __typename
              ... on RunStatsSnapshot {
                enqueuedTime
                launchTime
                startTime
                endTime
                stepsFailed
                stepsSucceeded
                materializations
                expectations
              }
            }
            stepStats {
              stepKey
              status
              startTime
              endTime
              materializations {
                __typename
              }
              expectationResults {
                success
              }
            }
          }
          ... on RunNotFoundError {
            message
          }
          ... on PythonError {
            message
          }
        }
      }
    `;

    return this.graphqlQuery('GetRunStatus', query, { runId });
  }

  async getLastRunsForPartition(jobName, partitionName, limit = 3) {
    if (!jobName) throw new Error('jobName is required');
    if (!partitionName) throw new Error('partitionName is required');

    const query = `
      query GetLastRunsForPartition(
        $filter: RunsFilter!
        $limit: Int!
      ) {
        runsOrError(filter: $filter, limit: $limit) {
          __typename
          ... on Runs {
            results {
              runId
              status
              startTime
              endTime
              updateTime
              jobName
              mode
              tags {
                key
                value
              }
              stats {
                __typename
                ... on RunStatsSnapshot {
                  enqueuedTime
                  launchTime
                  startTime
                  endTime
                  stepsFailed
                  stepsSucceeded
                  materializations
                  expectations
                }
              }
            }
          }
          ... on PythonError {
            message
          }
        }
      }
    `;

    const filter = {
      pipelineName: jobName,
      tags: [
        { key: "dagster/partition", value: partitionName }
      ]
    };

    return this.graphqlQuery('GetLastRunsForPartition', query, {
      filter,
      limit
    });
  }

}

module.exports = DagsterAPI;
