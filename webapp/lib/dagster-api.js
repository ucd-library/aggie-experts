const { config } = require('@ucd-lib/experts-commons');
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


  launchRun(jobName, runConfig = {}) {
    if (!jobName) throw new Error('jobName is required');

    if (typeof runConfig === 'object') {
      runConfig = yaml.stringify(runConfig);
    }

    const mutation = `
      mutation LaunchRunMutation(
        $repositoryLocationName: String!
        $repositoryName: String!
        $jobName: String!
        $runConfigData: RunConfigData!
      ) {
        launchRun(
          executionParams: {
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
      this.wrapDefaults({ jobName, runConfigData: runConfig })
    );
  }

  /**
   * Build an op config object for scholarly record operations, with explicit
   * elasticsearch and cdl flags overriding whatever was in opts.
   *
   * @param {String} expertId
   * @param {String} relationshipId
   * @param {Object} opts
   * @param {String} elasticsearch - 'yes' or 'no'
   * @param {String} cdl - 'yes' or 'no'
   * @returns {Object}
   */
  _scholarlyRecordRunConfig(expertId, relationshipId, opts, elasticsearch, cdl) {
    return {
      ops: {
        update_scholarly_record: {
          config: {
            expert_id: expertId,
            relationship_id: relationshipId,
            type: opts.type || 'work',
            elasticsearch,
            cdl,
            ...(opts.visibility && { visibility: opts.visibility }),
            ...(opts.favorite && { favorite: opts.favorite }),
            ...(opts.reject && { reject: opts.reject }),
          },
        },
      },
    };
  }

  /**
   * Launch ES and/or CDL Dagster jobs for a scholarly record update. When both
   * targets are requested the two jobs run in parallel and their results are
   * returned under separate keys so callers can track each run independently.
   *
   * @param {String} expertId
   * @param {String} relationshipId
   * @param {Object} opts
   * @returns {Promise<{es: Object|null, cdl: Object|null}>}
   */
  async runUpdateScholarlyRecord(expertId, relationshipId, opts = {}) {
    if (!expertId) throw new Error('expertId is required');
    if (!relationshipId) throw new Error('relationshipId is required');

    const doEs = opts.elasticsearch !== 'no';
    const doCdl = opts.cdl !== 'no';

    const [es, cdl] = await Promise.all([
      doEs
        ? this.launchRun(
            'update_scholarly_record_es_job',
            JSON.stringify(this._scholarlyRecordRunConfig(expertId, relationshipId, opts, 'yes', 'no'))
          )
        : Promise.resolve(null),
      doCdl
        ? this.launchRun(
            'update_scholarly_record_cdl_job',
            JSON.stringify(this._scholarlyRecordRunConfig(expertId, relationshipId, opts, 'no', 'yes'))
          )
        : Promise.resolve(null),
    ]);

    return { es, cdl };
  }

  /**
   * Build an op config object for expert operations.
   *
   * @param {String} expertId
   * @param {Object} opts
   * @param {String} elasticsearch - 'yes' or 'no'
   * @param {String} cdl - 'yes' or 'no'
   * @returns {Object}
   */
  _expertRunConfig(expertId, opts, elasticsearch, cdl) {
    return {
      ops: {
        update_expert: {
          config: {
            expert_id: expertId,
            elasticsearch,
            cdl,
            ...(opts.visibility && { visibility: opts.visibility }),
            ...(opts.delete && { delete: opts.delete }),
          },
        },
      },
    };
  }

  /**
   * Launch ES and/or CDL Dagster jobs for an expert update or delete.
   *
   * @param {String} expertId
   * @param {Object} opts
   * @returns {Promise<{es: Object|null, cdl: Object|null}>}
   */
  async runUpdateExpert(expertId, opts = {}) {
    if (!expertId) throw new Error('expertId is required');

    const doEs = opts.elasticsearch !== 'no';
    const doCdl = opts.cdl !== 'no';

    const [es, cdl] = await Promise.all([
      doEs
        ? this.launchRun(
            'update_expert_es_job',
            JSON.stringify(this._expertRunConfig(expertId, opts, 'yes', 'no'))
          )
        : Promise.resolve(null),
      doCdl
        ? this.launchRun(
            'update_expert_cdl_job',
            JSON.stringify(this._expertRunConfig(expertId, opts, 'no', 'yes'))
          )
        : Promise.resolve(null),
    ]);

    return { es, cdl };
  }

  /**
   * Build an op config object for expert availability operations.
   *
   * @param {String} expertId
   * @param {Object} labels
   * @param {String} elasticsearch - 'yes' or 'no'
   * @param {String} cdl - 'yes' or 'no'
   * @returns {Object}
   */
  _expertAvailabilityRunConfig(expertId, labels, elasticsearch, cdl) {
    return {
      ops: {
        update_expert_availability: {
          config: {
            expert_id: expertId,
            elasticsearch,
            cdl,
            labels_to_add: labels.labelsToAddOrEdit || [],
            labels_to_remove: labels.labelsToRemove || [],
            current_labels: labels.currentLabels || [],
          },
        },
      },
    };
  }

  /**
   * Launch ES and/or CDL Dagster jobs for an expert availability update.
   *
   * @param {String} expertId
   * @param {Object} labels
   * @param {Object} opts
   * @returns {Promise<{es: Object|null, cdl: Object|null}>}
   */
  async runUpdateExpertAvailability(expertId, labels = {}, opts = {}) {
    if (!expertId) throw new Error('expertId is required');

    const doEs = opts.elasticsearch !== 'no';
    const doCdl = opts.cdl !== 'no';

    const [es, cdl] = await Promise.all([
      doEs
        ? this.launchRun(
            'update_expert_availability_es_job',
            JSON.stringify(this._expertAvailabilityRunConfig(expertId, labels, 'yes', 'no'))
          )
        : Promise.resolve(null),
      doCdl
        ? this.launchRun(
            'update_expert_availability_cdl_job',
            JSON.stringify(this._expertAvailabilityRunConfig(expertId, labels, 'no', 'yes'))
          )
        : Promise.resolve(null),
    ]);

    return { es, cdl };
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
