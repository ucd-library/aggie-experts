const router = require('express').Router();
const { openapi, json_only, dagster_can_run_partition, public_or_is_user } = require('../middleware/index.js');
const DagsterAPI = require('../../lib/dagster-api.js');
const {logger, config} = require('@ucd-lib/experts-commons');

const dagsterAPI = new DagsterAPI();

// Endpoint to trigger a Dagster job for a specific partition
router.post('/run-job-partition', json_only,
  dagster_can_run_partition(),
  async (req, res, next) => {
  try {
    const { jobName, partition, runConfig } = req.body;
    if (!jobName || !partition) {
      return res.status(400).json({ error: 'jobName and partition are required' });
    }

    const result = await dagsterAPI.runJobPartition(jobName, partition, runConfig);
    res.json(result);
  } catch (error) {
    logger.error('Error running Dagster job partition', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/run/:runId',
  dagster_can_run_partition({requirePartition: false}),
  async (req, res, next) => {
  try {
    const { runId } = req.params;
    
    if (!runId) {
      return res.status(400).json({ error: 'runId is required' });
    }
    
    const result = await dagsterAPI.getRunStatus(runId);
    res.json(result);
  } catch (error) {
    logger.error('Error fetching Dagster run status', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get last N runs for a specific partition
router.post('/last-runs-for-partition',
  dagster_can_run_partition(),
  async (req, res, next) => {
  try {
    const { jobName, partition, limit = 3 } = req.body;
    if (!jobName || !partition) {
      return res.status(400).json({ error: 'jobName and partition are required' });
    }

    const result = await dagsterAPI.getLastRunsForPartition(jobName, partition, parseInt(limit, 10));
    res.json(result);
  } catch (error) {
    logger.error('Error fetching last runs for partition', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/health',
  public_or_is_user,
  async (req, res) => {
    const daemonHeartbeatStaleMs = 60 * 1000;

    const startedAt = Date.now();
    const now = Date.now();

    try {
      // check dagster ui health
      const uiResp = await fetch(`${config.dagster.host}/server_info`);
      if( !uiResp.ok ) {
        throw new Error(`Dagster UI probe failed: ${uiResp.status} ${uiResp.statusText}`);
      }

      const query = `
        query DagsterServiceHealth {
          instance {
            daemonHealth {
              allDaemonStatuses {
                daemonType
                healthy
                required
                lastHeartbeatTime
                lastHeartbeatErrors {
                  message
                }
              }
            }
          }
        }
      `;

      const gqlResp = await dagsterAPI.graphqlQuery(
        'DagsterServiceHealth',
        query,
        {}
      );

      // check deamon health
      const daemonStatuses =
        gqlResp?.data?.instance?.daemonHealth?.allDaemonStatuses || [];

      const requiredUnhealthy = daemonStatuses.filter(s => {
        if (!s.required) return false;
        if (!s.healthy) return true;
        if (s.lastHeartbeatTime) {
          const ageMs = now - s.lastHeartbeatTime * 1000;
          if (ageMs > daemonHeartbeatStaleMs) return true;
        }
        return false;
      });

      // build response
      const reasons = requiredUnhealthy.map(s => {
        const ageMs = s.lastHeartbeatTime
          ? now - s.lastHeartbeatTime * 1000
          : null;
        return {
          daemonType: s.daemonType,
          reason: ageMs !== null && ageMs > daemonHeartbeatStaleMs && s.healthy
            ? `heartbeat stale (${Math.round(ageMs / 1000)}s ago)`
            : 'required daemon unhealthy',
          errors: (s.lastHeartbeatErrors || []).map(e => e.message)
        };
      });

      const status = reasons.length ? 'degraded' : 'healthy';

      return res.status(status === 'healthy' ? 200 : 503).json({
        status,
        service: 'dagster',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        reasons,
        details: {
          requiredDaemonCount: daemonStatuses.filter(s => s.required).length,
          unhealthyRequiredDaemonCount: requiredUnhealthy.length,
          uiReachable: true
        }
      });
    } catch (error) {
      logger.error('Error fetching Dagster health', error);

      return res.status(503).json({
        status: 'down',
        service: 'dagster',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        reasons: [{
          reason: 'dagster graphql request failed',
          message: error.message
        }]
      });
    }
  }
);

// Endpoint to update a scholarly record (work or grant) via Dagster
router.post('/admin-update/scholarly-record', 
  json_only,
  dagster_can_run_partition({requirePartition: false}),
  async (req, res, next) => {
  try {
    const { expertId, relationshipId, type, elasticsearch, visibility, favorite, reject } = req.body;
    let cdl = config.experts.propogateCdlChanges === true ? 'yes' : 'no';
    if (!expertId || !relationshipId) {
      return res.status(400).json({ error: 'expertId and relationshipId are required' });
    }

    const result = await dagsterAPI.runUpdateScholarlyRecord(expertId, relationshipId, {
      type, elasticsearch, cdl, visibility, favorite, reject
    });
    res.json(result);
  } catch (error) {
    logger.error('Error running admin-update scholarly-record', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to update or delete an expert record via Dagster
router.post('/admin-update/expert', 
  json_only,
  dagster_can_run_partition({requirePartition: false}),
  async (req, res, next) => {
  try {
    const { expertId, elasticsearch, visibility, delete: del } = req.body;
    let cdl = config.experts.propogateCdlChanges === true ? 'yes' : 'no';
    if (!expertId) {
      return res.status(400).json({ error: 'expertId is required' });
    }

    const result = await dagsterAPI.runUpdateExpert(expertId, {
      elasticsearch, cdl, visibility, delete: del
    });
    res.json(result);
  } catch (error) {
    logger.error('Error running admin-update expert', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to update expert availability labels via Dagster
router.post('/admin-update/availability',
  json_only,
  dagster_can_run_partition({requirePartition: false}),
  async (req, res, next) => {
  try {
    const { expertId, elasticsearch, labelsToAddOrEdit, labelsToRemove, currentLabels } = req.body;
    let cdl = config.experts.propogateCdlChanges === true ? 'yes' : 'no';
    if (!expertId) {
      return res.status(400).json({ error: 'expertId is required' });
    }

    const result = await dagsterAPI.runUpdateExpertAvailability(expertId, {
      labelsToAddOrEdit, labelsToRemove, currentLabels
    }, { elasticsearch, cdl });
    res.json(result);
  } catch (error) {
    logger.error('Error running admin-update availability', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
