import 'dotenv/config';

const env = process.env;

/**
 * @description Application configuration, populated from environment variables
 * (loaded from .env via dotenv). Grouped by subsystem.
 */
const config = {
  cloudflare: {
    apiToken: env.CF_API_TOKEN || '',
    accountId: env.CF_ACCOUNT_ID || '',
    zoneId: env.CF_ZONE_ID || '',
    appName: env.CF_APP_NAME || '',
    apiBaseUrl: env.CF_API_BASE_URL || 'https://api.cloudflare.com/client/v4/graphql',
    requestTimeoutMs: env.CF_REQUEST_TIMEOUT_MS ? parseInt(env.CF_REQUEST_TIMEOUT_MS) : 30000,
    botScoreThreshold: env.CF_BOT_SCORE_THRESHOLD ? parseInt(env.CF_BOT_SCORE_THRESHOLD) : 30,
    apiPathPrefix: env.CF_API_PATH_PREFIX || '/api/',
    statusClass: env.CF_STATUS_CLASS || '2xx'
  },
  report: {
    defaultDays: env.AE_AF_DEFAULT_DAYS ? parseInt(env.AE_AF_DEFAULT_DAYS) : 30,
    defaultTopPagesLimit: env.AE_AF_TOP_PAGES_LIMIT ? parseInt(env.AE_AF_TOP_PAGES_LIMIT) : 50,
    outputDir: env.AE_AF_OUTPUT_DIR || '.',
    gcsBucket: env.AE_AF_GCS_BUCKET || ''
  },
  debug: env.AE_AF_DEBUG === 'true'
};

export default config;
