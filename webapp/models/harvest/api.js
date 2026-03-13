const router = require('express').Router();
const { openapi, json_only, user_can_edit, public_or_is_user } = require('../middleware/index.js');
const DagsterAPI = require('../../lib/dagster-api.js');
const {logger} = require('@ucd-lib/experts-commons');


const dagsterAPI = new DagsterAPI();

// Endpoint to trigger a Dagster job for a specific partition
router.post('/run-job-partition', json_only,
  user_can_edit,
  async (req, res, next) => {
  try {
    const { jobName, partitionName, runConfig } = req.body;
    if (!jobName || !partitionName) {
      return res.status(400).json({ error: 'jobName and partitionName are required' });
    }

    const result = await dagsterAPI.runJobPartition(jobName, partitionName, runConfig);
    res.json(result);
  } catch (error) {
    logger.error('Error running Dagster job partition', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/run/:runId',
  user_can_edit,
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
  user_can_edit,
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

module.exports = router;
