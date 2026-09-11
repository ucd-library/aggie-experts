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
   * @method runUpdateScholarlyRecord
   * @description Launch a single Dagster job that updates a work or grant record in
   * CDL/Elements (update_scholarly_record_cdl step), then Elasticsearch and Postgres
   * (which are skipped if the CDL step fails).
   *
   * @param {String} expertId
   * @param {String} relationshipId
   * @param {Object} opts
   * @param {String} opts.type - 'work' or 'grant'
   * @param {String} opts.visibility - 'yes' or 'no'
   * @param {String} opts.favorite - 'yes' or 'no'
   * @param {String} opts.reject - 'yes' or 'no'
   * @param {String} opts.cdl - 'yes' or 'no'; controls cdl_enabled on the CDL step
   * @param {Boolean} opts.force - bypass CDL/Elements entirely; only update Elasticsearch and Postgres
   * @returns {Promise<Object>} Dagster launchRun GraphQL response
   */
  async runUpdateScholarlyRecord(expertId, relationshipId, opts = {}) {
    if (!expertId) throw new Error('expertId is required');
    if (!relationshipId) throw new Error('relationshipId is required');

    const sharedConfig = {
      expert_id: expertId,
      relationship_id: relationshipId,
      type: opts.type || 'work',
      ...(opts.visibility && { visibility: opts.visibility }),
      ...(opts.favorite && { favorite: opts.favorite }),
      ...(opts.reject && { reject: opts.reject }),
    };

    if (opts.force) {
      const runConfig = {
        ops: {
          update_scholarly_record_es: { config: sharedConfig },
          update_scholarly_record_postgres: { config: sharedConfig },
        },
      };
      return this.launchRun('force_update_scholarly_record_job', JSON.stringify(runConfig));
    }

    const cdlEnabled = opts.cdl !== 'no';
    const runConfig = {
      ops: {
        update_scholarly_record_es: { config: sharedConfig },
        update_scholarly_record_cdl: { config: { ...sharedConfig, cdl_enabled: cdlEnabled } },
        update_scholarly_record_postgres: { config: sharedConfig },
      },
    };

    return this.launchRun('update_scholarly_record_job', JSON.stringify(runConfig));
  }

  /**
   * @method runUpdateExpert
   * @description Launch a single Dagster job that updates or deletes an expert record in
   * CDL/Elements (update_expert_cdl step), then Elasticsearch and Postgres (which are
   * skipped if the CDL step fails).
   *
   * @param {String} expertId
   * @param {Object} opts
   * @param {String} opts.visibility - 'yes' or 'no'
   * @param {String} opts.delete - 'yes' or 'no'
   * @param {String} opts.cdl - 'yes' or 'no'; controls cdl_enabled on the CDL step
   * @param {Boolean} opts.force - bypass CDL/Elements entirely; only update Elasticsearch and Postgres
   * @returns {Promise<Object>} Dagster launchRun GraphQL response
   */
  async runUpdateExpert(expertId, opts = {}) {
    if (!expertId) throw new Error('expertId is required');

    const esAndCdlConfig = {
      expert_id: expertId,
      ...(opts.visibility && { visibility: opts.visibility }),
      ...(opts.delete && { delete: opts.delete }),
    };
    // UpdateExpertPgConfig does not have a delete field, so omit it for postgres
    const pgConfig = {
      expert_id: expertId,
      ...(opts.visibility && { visibility: opts.visibility }),
    };

    if (opts.force) {
      const runConfig = {
        ops: {
          update_expert_es: { config: esAndCdlConfig },
          update_expert_postgres: { config: pgConfig },
        },
      };
      return this.launchRun('force_update_expert_job', JSON.stringify(runConfig));
    }

    const cdlEnabled = opts.cdl !== 'no';
    const runConfig = {
      ops: {
        update_expert_es: { config: esAndCdlConfig },
        update_expert_cdl: { config: { ...esAndCdlConfig, cdl_enabled: cdlEnabled } },
        update_expert_postgres: { config: pgConfig },
      },
    };

    return this.launchRun('update_expert_job', JSON.stringify(runConfig));
  }

  /**
   * @method runUpdateExpertAvailability
   * @description Launch a single Dagster job that updates expert availability labels in
   * CDL/Elements (update_expert_availability_cdl step), then Elasticsearch (which is
   * skipped if the CDL step fails). No force/bypass path exists for this action.
   *
   * @param {String} expertId
   * @param {Object} labels
   * @param {Array} labels.labelsToAddOrEdit
   * @param {Array} labels.labelsToRemove
   * @param {Array} labels.currentLabels
   * @param {Object} opts
   * @param {String} opts.cdl - 'yes' or 'no'; controls cdl_enabled on the CDL step
   * @returns {Promise<Object>} Dagster launchRun GraphQL response
   */
  async runUpdateExpertAvailability(expertId, labels = {}, opts = {}) {
    if (!expertId) throw new Error('expertId is required');

    const sharedConfig = {
      expert_id: expertId,
      labels_to_add: labels.labelsToAddOrEdit || [],
      labels_to_remove: labels.labelsToRemove || [],
      current_labels: labels.currentLabels || [],
    };

    const cdlEnabled = opts.cdl !== 'no';
    const runConfig = {
      ops: {
        update_expert_availability_es: { config: sharedConfig },
        update_expert_availability_cdl: { config: { ...sharedConfig, cdl_enabled: cdlEnabled } },
      },
    };

    return this.launchRun('update_expert_availability_job', JSON.stringify(runConfig));
  }

  /**
   * @method runJobPartition
   * @description launch a partitioned Dagster job run
   *
   * @param {String} jobName dagster job name
   * @param {String} partitionName dagster partition name (e.g. a user email)
   * @param {Object} runConfig optional run config object
   * @param {Object} opts
   * @param {Number} opts.priority optional run-level priority override. when set this is
   *   injected into executionMetadata.tags as dagster/priority, overriding the job's
   *   default priority tag. use this to promote UI-triggered runs above bulk ETL runs
   *   that share the same job definition.
   * @returns {Promise}
   */
  runJobPartition(jobName, partitionName, runConfig = {}, opts = {}) {
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

    const priorityTag = opts.priority != null
      ? `, {key:"dagster/priority", value: "${opts.priority}"}`
      : '';

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
                ${priorityTag}
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

  /**
   * @method sendSlackNotification
   * @description Materialize the send_slack_notification dagster asset, which
   * sends a Slack message via the admin CLI. Uses the dagster auto-generated
   * __ASSET_JOB for the "admin" group.
   *
   * The runConfig ops key must match the asset name exactly.
   *
   * @param {Object} opts
   * @param {String} opts.title - Slack message title
   * @param {String} [opts.message] - Slack message body
   * @param {String} [opts.severity] - 'info', 'warning', or 'error'
   * @param {String} [opts.source] - source label shown in the notification
   * @param {String[]} [opts.mentions] - Slack member IDs to @mention
   * @returns {Promise<Object>} Dagster launchRun GraphQL response
   */
  sendSlackNotification(opts = {}) {
    const { title, message = '', severity = 'info', source = 'webapp', mentions = [] } = opts;
    if( !title ) throw new Error('title is required');

    const runConfig = {
      ops: {
        send_slack_notification: {
          config: { title, message, severity, source, mentions }
        }
      }
    };

    // Dagster auto-generates a job called "__ASSET_JOB" (or a group-specific variant)
    // for assets that are not part of an explicit job. For assets in the "admin" group,
    // the auto-generated job name follows the pattern "__ASSET_JOB_{n}" — try the
    // canonical name first. If this needs adjustment, check the dagster UI under
    // Jobs for the admin group.
    return this.launchRun('__ASSET_JOB', JSON.stringify(runConfig));
  }

}

module.exports = DagsterAPI;
