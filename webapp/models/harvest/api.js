const router = require('express').Router();
const { openapi, json_only, user_can_edit, public_or_is_user } = require('../middleware/index.js');
const DagsterAPI = require('../../lib/dagster-api.js');

const dagsterAPI = new DagsterAPI();

// Endpoint to trigger a Dagster job for a specific partition
router.post('/run-job-partition', json_only, user_can_edit, async (req, res, next) => {
  try {
    const { jobName, partitionName, runConfig } = req.body;
    if (!jobName || !partitionName) {
      return res.status(400).json({ error: 'jobName and partitionName are required' });
    }

    const result = await dagsterAPI.runJobPartition(jobName, partitionName, runConfig);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/run/:runId', user_can_edit, async (req, res, next) => {
  try {
    const { runId } = req.params;
    if (!runId) {
      return res.status(400).json({ error: 'runId is required' });
    }

    const result = await dagsterAPI.getRunStatus(runId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Endpoint to get last N runs for a specific partition
router.get('/last-runs-for-partition', user_can_edit, async (req, res, next) => {
  try {
    const { jobName, partition, limit = 3 } = req.query;
    if (!jobName || !partition) {
      return res.status(400).json({ error: 'jobName and partition are required' });
    }

    const result = await dagsterAPI.getLastRunsForPartition(jobName, partition, parseInt(limit, 10));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
