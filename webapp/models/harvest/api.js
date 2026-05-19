const router = require('express').Router();
const { openapi, json_only, dagster_can_run_partition, public_or_is_user } = require('../middleware/index.js');
const DagsterAPI = require('../../lib/dagster-api.js');
const {logger} = require('@ucd-lib/experts-commons');


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

// Endpoint to update a scholarly record (work or grant) via Dagster
router.post('/admin-updates/scholarly-record', 
  json_only,
  dagster_can_run_partition({requirePartition: false}),
  async (req, res, next) => {
  try {
    const { expertId, relationshipId, type, elasticsearch, cdl, visibility, favorite, reject } = req.body;
    if (!expertId || !relationshipId) {
      return res.status(400).json({ error: 'expertId and relationshipId are required' });
    }

    const result = await dagsterAPI.runUpdateScholarlyRecord(expertId, relationshipId, {
      type, elasticsearch, cdl, visibility, favorite, reject
    });
    res.json(result);
  } catch (error) {
    logger.error('Error running admin-updates scholarly-record', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to update or delete an expert record via Dagster
router.post('/admin-updates/expert', 
  json_only,
  dagster_can_run_partition({requirePartition: false}),
  async (req, res, next) => {
  try {
    const { expertId, elasticsearch, cdl, visibility, delete: del } = req.body;
    if (!expertId) {
      return res.status(400).json({ error: 'expertId is required' });
    }

    const result = await dagsterAPI.runUpdateExpert(expertId, {
      elasticsearch, cdl, visibility, delete: del
    });
    res.json(result);
  } catch (error) {
    logger.error('Error running admin-updates expert', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to update expert availability labels via Dagster
router.post('/admin-updates/expert-availability',
  json_only,
  dagster_can_run_partition({requirePartition: false}),
  async (req, res, next) => {
  try {
    const { expertId, elasticsearch, cdl, labelsToAddOrEdit, labelsToRemove, currentLabels } = req.body;
    if (!expertId) {
      return res.status(400).json({ error: 'expertId is required' });
    }

    const result = await dagsterAPI.runUpdateExpertAvailability(expertId, {
      labelsToAddOrEdit, labelsToRemove, currentLabels
    }, { elasticsearch, cdl });
    res.json(result);
  } catch (error) {
    logger.error('Error running admin-updates expert-availability', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
