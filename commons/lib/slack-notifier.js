/**
 * Slack Notifier - Sends messages to Slack via incoming webhook.
 * Reads the webhook URL from the SLACK_WEBHOOK_URL environment variable.
 */

import { logger } from './logger.js';

class SlackNotifier {

  /**
   * Send a Slack notification.
   * @param {object} opts - Options object
   * @param {string} opts.source - Source of the notification (e.g. 'dagster')
   * @param {string} opts.severity - 'info', 'warning', or 'error'
   * @param {string} opts.title - Message title
   * @param {string} opts.message - Message body
   * @param {object} opts.context - Optional key/value pairs shown as fields in the attachment
   * @returns {Promise<boolean>} True if the message was sent
   */
  async send(opts = {}) {
    const {
      source = 'aggie-experts',
      severity = 'info',
      title = 'Notification',
      message = '',
      context = null,
    } = opts;

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.warn(`SlackNotifier: SLACK_WEBHOOK_URL not set, skipping notification: ${title}`);
      return false;
    }

    try {
      const color = this._getColorForSeverity(severity);

      let text = message;
      if (context && typeof context === 'object') {
        const contextLines = Object.entries(context)
          .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
          .join('\n');
        text = text ? `${text}\n${contextLines}` : contextLines;
      }

      const payload = {
        attachments: [
          {
            color,
            title,
            text,
            footer: source,
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack API returned ${response.status} ${response.statusText}`);
      }

      logger.info(`SlackNotifier: Sent notification - ${title}`);
      return true;
    } catch (err) {
      logger.error(`SlackNotifier: Failed to send notification - ${err.message}`);
      return false;
    }
  }

  /**
   * Get Slack color code for severity.
   * @param {string} severity - 'info', 'warning', or 'error'
   * @returns {string} Hex color code
   */
  _getColorForSeverity(severity) {
    const colors = {
      info: '#0099ff',
      warning: '#ffaa00',
      error: '#ff0000',
    };
    return colors[severity] || colors.info;
  }
}

const inst = new SlackNotifier();
export default inst;
