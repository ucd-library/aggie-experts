/**
 * Slack Notifier - Sends messages to Slack via incoming webhook.
 */

import { logger } from './logger.js';
import GoogleSecret from './google-secret.js';

class SlackNotifier {
  constructor() {
    this.webhookUrl = null;
    this.initialized = false;
  }

  /**
   * Initialize the notifier with either a webhook URL or a secret name.
   * @param {string} webhookUrlOrSecretName - Direct webhook URL or Google Secret Manager secret name
   * @param {object} opts - Options object
   * @param {boolean} opts.isSecretName - If true, treat input as a secret name to resolve via Google Secret Manager
   */
  async init(webhookUrlOrSecretName, opts = {}) {
    if (!webhookUrlOrSecretName) {
      logger.warn('SlackNotifier: No webhook URL or secret name provided');
      return;
    }

    try {
      if (opts.isSecretName) {
        this.webhookUrl = await GoogleSecret.getSecret(webhookUrlOrSecretName);
        logger.info(`SlackNotifier initialized from secret: ${webhookUrlOrSecretName}`);
      } else {
        this.webhookUrl = webhookUrlOrSecretName;
        logger.info('SlackNotifier initialized with direct webhook URL');
      }
      this.initialized = true;
    } catch (err) {
      logger.error(`SlackNotifier initialization failed: ${err.message}`);
    }
  }

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

    if (!this.initialized || !this.webhookUrl) {
      logger.warn(`SlackNotifier not initialized, skipping notification: ${title}`);
      return false;
    }

    try {
      const color = this._getColorForSeverity(severity);
      const payload = {
        text: `[${source.toUpperCase()}] ${title}`,
        attachments: [
          {
            color,
            text: message,
            footer: source,
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      if (context && typeof context === 'object') {
        payload.attachments[0].fields = Object.entries(context).map(([key, value]) => ({
          title: key.replace(/_/g, ' ').toUpperCase(),
          value: String(value),
          short: true,
        }));
      }

      const response = await fetch(this.webhookUrl, {
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
