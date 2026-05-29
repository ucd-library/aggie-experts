const router = require('express').Router();
const { logger, SlackNotifier } = require('@ucd-lib/experts-commons');

/**
 * POST /notify
 * Internal endpoint for sending Slack notifications.
 *
 * Request body:
 *   {
 *     source: string,    // Source of notification (e.g. 'dagster')
 *     severity: string,  // 'info', 'warning', 'error'
 *     title: string,     // Message title
 *     message: string,   // Message body
 *     context: object    // Optional key/value pairs shown as fields
 *   }
 *
 * Response:
 *   { success: boolean, reason: string }
 */
router.post('/notify', async (req, res) => {
  try {
    const { source = 'aggie-experts', severity = 'info', title, message, context } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, reason: 'Missing required field: title' });
    }

    const sent = await SlackNotifier.send({ source, severity, title, message: message || '', context });

    return res.status(200).json({ success: sent, reason: sent ? 'Notification sent' : 'SlackNotifier not initialized' });
  } catch (error) {
    logger.error('Error processing notification request', error);
    return res.status(500).json({ success: false, reason: `Internal error: ${error.message}` });
  }
});

module.exports = { api: router };
