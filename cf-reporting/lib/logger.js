/**
 * @description Thin console-based logger with the same call shape as @ucd-lib/logger
 * (info/warn/error/debug), so it's a drop-in swap if this tool is later folded into
 * a deployed service.
 */
const logger = {
  /**
   * @param {...any} args - Values to log.
   * @returns {void}
   */
  info(...args) {
    console.log('[info]', ...args);
  },

  /**
   * @param {...any} args - Values to log.
   * @returns {void}
   */
  warn(...args) {
    console.warn('[warn]', ...args);
  },

  /**
   * @param {...any} args - Values to log.
   * @returns {void}
   */
  error(...args) {
    console.error('[error]', ...args);
  },

  /**
   * @param {...any} args - Values to log.
   * @returns {void}
   */
  debug(...args) {
    if (process.env.AE_AF_DEBUG === 'true') {
      console.log('[debug]', ...args);
    }
  }
};

export default logger;
