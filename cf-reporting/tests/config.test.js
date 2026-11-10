import assert from 'assert';

describe('lib/config.js', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('defaults apiBaseUrl when CF_API_BASE_URL is unset', async () => {
    delete process.env.CF_API_BASE_URL;
    const { default: config } = await import(`../lib/config.js?t=${Math.random()}`);
    assert.strictEqual(config.cloudflare.apiBaseUrl, 'https://api.cloudflare.com/client/v4/graphql');
  });

  it('respects CF_API_BASE_URL override', async () => {
    process.env.CF_API_BASE_URL = 'https://custom.example.com/graphql';
    const { default: config } = await import(`../lib/config.js?t=${Math.random()}`);
    assert.strictEqual(config.cloudflare.apiBaseUrl, 'https://custom.example.com/graphql');
  });

  it('parses CF_BOT_SCORE_THRESHOLD as an integer', async () => {
    process.env.CF_BOT_SCORE_THRESHOLD = '45';
    const { default: config } = await import(`../lib/config.js?t=${Math.random()}`);
    assert.strictEqual(config.cloudflare.botScoreThreshold, 45);
  });

  it('defaults AE_AF_TOP_PAGES_LIMIT to 50', async () => {
    delete process.env.AE_AF_TOP_PAGES_LIMIT;
    const { default: config } = await import(`../lib/config.js?t=${Math.random()}`);
    assert.strictEqual(config.report.defaultTopPagesLimit, 50);
  });

  it('falls back appName to empty string when CF_APP_NAME is unset', async () => {
    delete process.env.CF_APP_NAME;
    const { default: config } = await import(`../lib/config.js?t=${Math.random()}`);
    assert.strictEqual(config.cloudflare.appName, '');
  });

  it('defaults statusClass to 2xx when CF_STATUS_CLASS is unset', async () => {
    delete process.env.CF_STATUS_CLASS;
    const { default: config } = await import(`../lib/config.js?t=${Math.random()}`);
    assert.strictEqual(config.cloudflare.statusClass, '2xx');
  });

  it('respects CF_STATUS_CLASS override', async () => {
    process.env.CF_STATUS_CLASS = '4xx';
    const { default: config } = await import(`../lib/config.js?t=${Math.random()}`);
    assert.strictEqual(config.cloudflare.statusClass, '4xx');
  });
});
